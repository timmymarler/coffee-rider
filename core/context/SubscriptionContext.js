import { db } from '@config/firebase';
import { functions } from '@config/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const syncStripeSubscriptionStateCallable = httpsCallable(functions, 'syncStripeSubscriptionState');
const activateAppleSubscriptionCallable = httpsCallable(functions, 'activateAppleSubscription');
const APPLE_LOCAL_EXPIRY_GRACE_MS = 3 * 60 * 1000;

export const SubscriptionContext = createContext();

export function SubscriptionProvider({ children, userId }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);
  const expirationCheckRef = useRef(null);
  const userSyncRef = useRef({ status: null, expiresAt: null });
  const pendingSyncRef = useRef({ inFlight: false, lastSubscriptionId: null, lastAttemptAt: 0 });
  const pendingAppleSyncRef = useRef({ inFlight: false, lastKey: null, lastAttemptAt: 0 });

  const toDate = useCallback((value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value);
    }
    if (value?.seconds && Number.isFinite(value.seconds)) {
      return new Date(value.seconds * 1000);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }, []);

  const maybeRecoverAppleSubscription = useCallback(async (subData) => {
    if (!userId || !subData) return;
    if (subData.status !== 'active' || subData.provider !== 'apple_iap') return;

    const originalTransactionId = subData.appleOriginalTransactionId || subData.appleTransactionId || null;
    const transactionId = subData.appleTransactionId || subData.appleOriginalTransactionId || null;
    const productId = subData.appleProductId || null;
    if (!originalTransactionId || !transactionId || !productId) {
      return;
    }

    const now = Date.now();
    const syncKey = `${originalTransactionId}:${transactionId}`;
    const isSameKey = pendingAppleSyncRef.current.lastKey === syncKey;
    const isCoolingDown = isSameKey && now - pendingAppleSyncRef.current.lastAttemptAt < 60_000;
    if (pendingAppleSyncRef.current.inFlight || isCoolingDown) {
      return;
    }

    pendingAppleSyncRef.current.inFlight = true;
    pendingAppleSyncRef.current.lastKey = syncKey;
    pendingAppleSyncRef.current.lastAttemptAt = now;

    try {
      const result = await activateAppleSubscriptionCallable({
        userId,
        email: subData.email || null,
        productId,
        transactionId,
        originalTransactionId,
        purchaseDateMs: Number.isFinite(subData.purchaseDate) ? subData.purchaseDate : Date.now(),
      });
      console.log('[Subscription] Apple renewal recovery sync attempted:', result?.data || null);
    } catch (err) {
      console.error('[Subscription] Apple renewal recovery sync failed:', err);
    } finally {
      pendingAppleSyncRef.current.inFlight = false;
    }
  }, [userId]);

  const maybeRecoverPendingStripeSubscription = useCallback(async (subData) => {
    if (!userId || !subData) return;
    if (subData.status !== 'pending' || subData.provider !== 'stripe') return;

    const stripeSubscriptionId = subData.stripeSubscriptionId || null;
    const now = Date.now();
    const isSameSub = pendingSyncRef.current.lastSubscriptionId === stripeSubscriptionId;
    const isCoolingDown = isSameSub && now - pendingSyncRef.current.lastAttemptAt < 60_000;

    if (pendingSyncRef.current.inFlight || isCoolingDown) {
      return;
    }

    pendingSyncRef.current.inFlight = true;
    pendingSyncRef.current.lastSubscriptionId = stripeSubscriptionId;
    pendingSyncRef.current.lastAttemptAt = now;

    try {
      const result = await syncStripeSubscriptionStateCallable({ stripeSubscriptionId });
      console.log('[Subscription] Pending Stripe sync attempted:', result?.data || null);
    } catch (err) {
      console.error('[Subscription] Pending Stripe sync failed:', err);
    } finally {
      pendingSyncRef.current.inFlight = false;
    }
  }, [userId]);

  const syncUserSubscriptionProfile = useCallback(
    async ({ fields, logLabel }) => {
      if (!userId) return;

      try {
        await updateDoc(doc(db, 'users', userId), fields);
      } catch (err) {
        console.error(`[Subscription] Error syncing ${logLabel} to user profile:`, err);
      }
    },
    [userId]
  );

  // Check if subscription has expired
  const checkAndUpdateExpiration = useCallback((subData) => {
    if (!subData) {
      console.log('[Subscription] No subscription data to check');
      return null;
    }

    // Check if trial is active
    if (subData.status === 'trial') {
      // Handle different date formats: numeric (ms), Timestamp object, or Date
      const trialEndDate = toDate(subData.trialEndsAt);
      if (!trialEndDate) {
        console.log('[Subscription] Trial end date missing/invalid, keeping current trial state');
        return subData;
      }
      
      const now = new Date();
      console.log('[Subscription] Trial end date:', trialEndDate.toISOString(), 'Current time:', now.toISOString());
      if (trialEndDate <= now) {
        // Trial has expired - update user profile in Firestore
        console.log('[Subscription] Trial has expired, updating user profile and clearing subscription');
        if (userId) {
          syncUserSubscriptionProfile({
            fields: {
              subscriptionStatus: 'expired',
              subscriptionExpiresAt: null,
            },
            logLabel: 'trial expiration',
          });
        }
        userSyncRef.current = { status: 'expired', expiresAt: null };
        return null;
      }
      console.log('[Subscription] Trial is still active');
      if (userId) {
        const expiresAtMs = trialEndDate.getTime();
        if (
          userSyncRef.current.status !== 'trial' ||
          userSyncRef.current.expiresAt !== expiresAtMs
        ) {
          userSyncRef.current = { status: 'trial', expiresAt: expiresAtMs };
          syncUserSubscriptionProfile({
            fields: {
              subscriptionStatus: 'trial',
              subscriptionExpiresAt: expiresAtMs,
            },
            logLabel: 'trial status',
          });
        }
      }
      return subData;
    }

    // Check if subscription is active
    if (subData.status === 'active') {
      // Handle different date formats
      const renewalDate = toDate(subData.renewalDate);
      if (!renewalDate) {
        console.log('[Subscription] Renewal date missing/invalid, keeping active state for now');
        if (subData.provider === 'apple_iap') {
          maybeRecoverAppleSubscription(subData);
        }
        return subData;
      }
      
      const now = new Date();
      console.log('[Subscription] Renewal date:', renewalDate.toISOString(), 'Current time:', now.toISOString());
      if (renewalDate <= now) {
        if (subData.provider === 'apple_iap') {
          maybeRecoverAppleSubscription(subData);
          const expiryAgeMs = now.getTime() - renewalDate.getTime();
          if (expiryAgeMs >= 0 && expiryAgeMs <= APPLE_LOCAL_EXPIRY_GRACE_MS) {
            console.log('[Subscription] Apple renewal grace window active, delaying local downgrade');
            return subData;
          }
        }
        // Subscription has expired - update user profile in Firestore
        console.log('[Subscription] Subscription has expired, updating user profile and clearing subscription');
        if (userId) {
          syncUserSubscriptionProfile({
            fields: {
              subscriptionStatus: 'expired',
              subscriptionExpiresAt: null,
            },
            logLabel: 'subscription expiration',
          });
        }
        userSyncRef.current = { status: 'expired', expiresAt: null };
        return null;
      }
      console.log('[Subscription] Subscription is still active');
      if (userId) {
        const renewalMs = renewalDate.getTime();
        if (
          userSyncRef.current.status !== 'active' ||
          userSyncRef.current.expiresAt !== renewalMs
        ) {
          userSyncRef.current = { status: 'active', expiresAt: renewalMs };
          syncUserSubscriptionProfile({
            fields: {
              subscriptionStatus: 'active',
              subscriptionPlan: subData.plan || null,
              subscriptionExpiresAt: renewalMs,
            },
            logLabel: 'active status',
          });
        }
      }
      return subData;
    }

    // Cancelled, expired, or other invalid status
    console.log('[Subscription] Subscription status is', subData.status, ' - returning null');
    if (userId) {
      // Ensure user doc is synced to reflect no active subscription
      syncUserSubscriptionProfile({
        fields: {
          subscriptionStatus: subData.status || 'cancelled',
          subscriptionExpiresAt: null,
        },
        logLabel: 'cancelled status',
      });
    }
    return null;
  }, [userId, syncUserSubscriptionProfile, toDate, maybeRecoverAppleSubscription]);

  // Set up real-time listener and expiration check
  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const subRef = doc(db, 'users', userId, 'subscription', 'current');
      
      // Set up real-time listener
      unsubscribeRef.current = onSnapshot(
        subRef,
        (docSnap) => {
          console.log('[Subscription] Listener fired for userId:', userId);
          if (docSnap.exists()) {
            const subData = docSnap.data();
            console.log('[Subscription] Document data:', subData);
            maybeRecoverPendingStripeSubscription(subData);
            const validData = checkAndUpdateExpiration(subData);
            console.log('[Subscription] After expiration check:', validData);
            setSubscription(validData);
          } else {
            console.log('[Subscription] Subscription document does not exist');
            setSubscription(null);
          }
          setError(null);
          setLoading(false);
        },
        (err) => {
          console.error('[Subscription] Error listening to subscription:', err);
          setError(err.message);
          setSubscription(null);
          setLoading(false);
        }
      );
      console.log('[Subscription] Real-time listener set up for userId:', userId);

      // Set up interval to check expiration every 10 seconds (more frequent than before)
      expirationCheckRef.current = setInterval(() => {
        console.log('[Subscription] Running expiration check interval');
        setSubscription((currentSub) => {
          if (!currentSub) {
            console.log('[Subscription] No subscription to check');
            return null;
          }
          console.log('[Subscription] Checking expiration for current subscription');
          return checkAndUpdateExpiration(currentSub);
        });
      }, 10000); // Check every 10 seconds
      console.log('[Subscription] Expiration check interval set up (10 seconds)');

      // Set up app state listener to check expiration when app comes to foreground
      const appStateSubscription = AppState.addEventListener('change', (state) => {
        console.log('[Subscription] App state changed to:', state);
        if (state === 'active') {
          // App came to foreground, check expiration immediately
          console.log('[Subscription] App came to foreground, checking expiration immediately');
          setSubscription((currentSub) => {
            if (!currentSub) return null;
            return checkAndUpdateExpiration(currentSub);
          });
        }
      });

      // Cleanup
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        if (expirationCheckRef.current) {
          clearInterval(expirationCheckRef.current);
        }
        appStateSubscription.remove();
      };
    } catch (err) {
      console.error('[Subscription] Error setting up subscription listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [userId, checkAndUpdateExpiration, maybeRecoverPendingStripeSubscription]);

  const isSubscribed = useCallback(() => {
    return subscription !== null;
  }, [subscription]);

  const isInTrial = useCallback(() => {
    return subscription?.status === 'trial';
  }, [subscription]);

  const getTrialDaysRemaining = useCallback(() => {
    if (!isInTrial()) return 0;
    if (!subscription?.trialEndsAt) return 0;
    
    // Handle different date formats
    let trialEnd;
    if (typeof subscription.trialEndsAt === 'number') {
      trialEnd = new Date(subscription.trialEndsAt);
    } else if (subscription.trialEndsAt?.seconds) {
      trialEnd = new Date(subscription.trialEndsAt.seconds * 1000);
    } else {
      trialEnd = new Date(subscription.trialEndsAt);
    }
    
    const today = new Date();
    const daysLeft = Math.ceil((trialEnd - today) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  }, [subscription, isInTrial]);

  const value = {
    subscription,
    loading,
    error,
    isSubscribed,
    isInTrial,
    getTrialDaysRemaining,
    setSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

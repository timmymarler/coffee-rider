import { db } from '@config/firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export const SubscriptionContext = createContext();

export function SubscriptionProvider({ children, userId }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);
  const expirationCheckRef = useRef(null);
  const userSyncRef = useRef({ status: null, expiresAt: null });

  // Check if subscription has expired
  const checkAndUpdateExpiration = useCallback((subData) => {
    if (!subData) {
      console.log('[Subscription] No subscription data to check');
      return null;
    }

    // Check if trial is active
    if (subData.status === 'trial') {
      // Handle different date formats: numeric (ms), Timestamp object, or Date
      let trialEndDate;
      if (typeof subData.trialEndsAt === 'number') {
        trialEndDate = new Date(subData.trialEndsAt); // Already in milliseconds
      } else if (subData.trialEndsAt?.seconds) {
        trialEndDate = new Date(subData.trialEndsAt.seconds * 1000); // Firestore Timestamp
      } else {
        trialEndDate = new Date(subData.trialEndsAt); // Date object or string
      }
      
      const now = new Date();
      console.log('[Subscription] Trial end date:', trialEndDate.toISOString(), 'Current time:', now.toISOString());
      if (trialEndDate <= now) {
        // Trial has expired - update user profile in Firestore
        console.log('[Subscription] Trial has expired, updating user profile and clearing subscription');
        if (userId) {
          updateDoc(doc(db, 'users', userId), {
            role: 'user',
            subscriptionStatus: 'expired',
            subscriptionExpiresAt: null,
          }).catch((err) => {
            console.error('[Subscription] Error updating user profile on trial expiration:', err);
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
          updateDoc(doc(db, 'users', userId), {
            role: 'pro',
            subscriptionStatus: 'trial',
            subscriptionExpiresAt: expiresAtMs,
          }).catch((err) => {
            console.error('[Subscription] Error syncing trial status to user profile:', err);
          });
        }
      }
      return subData;
    }

    // Check if subscription is active
    if (subData.status === 'active') {
      // Handle different date formats
      let renewalDate;
      if (typeof subData.renewalDate === 'number') {
        renewalDate = new Date(subData.renewalDate);
      } else if (subData.renewalDate?.seconds) {
        renewalDate = new Date(subData.renewalDate.seconds * 1000);
      } else {
        renewalDate = new Date(subData.renewalDate);
      }
      
      const now = new Date();
      console.log('[Subscription] Renewal date:', renewalDate.toISOString(), 'Current time:', now.toISOString());
      if (renewalDate <= now) {
        // Subscription has expired - update user profile in Firestore
        console.log('[Subscription] Subscription has expired, updating user profile and clearing subscription');
        if (userId) {
          updateDoc(doc(db, 'users', userId), {
            role: 'user',
            subscriptionStatus: 'expired',
            subscriptionExpiresAt: null,
          }).catch((err) => {
            console.error('[Subscription] Error updating user profile on subscription expiration:', err);
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
          updateDoc(doc(db, 'users', userId), {
            role: 'pro',
            subscriptionStatus: 'active',
            subscriptionPlan: subData.plan || null,
            subscriptionExpiresAt: renewalMs,
          }).catch((err) => {
            console.error('[Subscription] Error syncing active status to user profile:', err);
          });
        }
      }
      return subData;
    }

    // Cancelled, expired, or other invalid status
    console.log('[Subscription] Subscription status is', subData.status);
    return null;
  }, [userId]);

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
  }, [userId, checkAndUpdateExpiration]);

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

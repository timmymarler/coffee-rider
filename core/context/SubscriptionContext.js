import { createContext, useState, useEffect, useCallback } from 'react';
import { db } from '@config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const SubscriptionContext = createContext();

export function SubscriptionProvider({ children, userId }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch subscription data from Firestore
  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    async function fetchSubscription() {
      try {
        setLoading(true);
        const subRef = doc(db, 'users', userId, 'subscription', 'current');
        const subDoc = await getDoc(subRef);
        
        if (subDoc.exists()) {
          const subData = subDoc.data();
          // Check if trial is still active or subscription is valid
          const isValid = checkSubscriptionValidity(subData);
          setSubscription(isValid ? subData : null);
        } else {
          setSubscription(null);
        }
        setError(null);
      } catch (err) {
        console.error('[Subscription] Error fetching subscription:', err);
        setError(err.message);
        setSubscription(null);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscription();
  }, [userId]);

  const checkSubscriptionValidity = (subData) => {
    if (!subData) return false;

    // Check if trial is active
    if (subData.status === 'trial') {
      const trialEndDate = new Date(subData.trialEndsAt?.seconds * 1000 || subData.trialEndsAt);
      return trialEndDate > new Date();
    }

    // Check if subscription is active
    if (subData.status === 'active') {
      const renewalDate = new Date(subData.renewalDate?.seconds * 1000 || subData.renewalDate);
      return renewalDate > new Date();
    }

    return false;
  };

  const isSubscribed = useCallback(() => {
    return subscription !== null && checkSubscriptionValidity(subscription);
  }, [subscription]);

  const isInTrial = useCallback(() => {
    return subscription?.status === 'trial' && checkSubscriptionValidity(subscription);
  }, [subscription]);

  const getTrialDaysRemaining = useCallback(() => {
    if (!isInTrial()) return 0;
    const trialEnd = new Date(subscription.trialEndsAt?.seconds * 1000 || subscription.trialEndsAt);
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

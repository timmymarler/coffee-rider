import { functions } from '@config/firebase';
import { useStripe } from '@stripe/stripe-react-native';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { SUBSCRIPTION_PLANS } from './stripeService';

const ensureStripeCustomerCallable = httpsCallable(functions, 'ensureStripeCustomer');
const createPaymentSheetCallable = httpsCallable(functions, 'createSubscriptionPaymentSheet');
const cancelStripeSubscriptionCallable = httpsCallable(functions, 'cancelStripeSubscription');

export function useStripeSubscription() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const appScheme = Constants.expoConfig?.scheme || Constants.expoConfig?.slug || 'coffeerider';
  const paymentSheetReturnUrl = `${appScheme}://stripe-redirect`;

  const planLookup = useMemo(() => {
    return Object.values(SUBSCRIPTION_PLANS).reduce((acc, plan) => {
      acc[plan.id] = plan;
      return acc;
    }, {});
  }, []);

  const subscribeToPlan = useCallback(
    async (planId) => {
      const normalizedPlanId = planId?.toLowerCase();
      const plan = planLookup[normalizedPlanId];
      if (!plan) {
        throw new Error('Unknown subscription plan selected.');
      }

      try {
        setStatus('initializing');
        setError(null);
        await ensureStripeCustomerCallable({});

        const paymentSheetResponse = await createPaymentSheetCallable({ planId: normalizedPlanId });
        const {
          customerId,
          ephemeralKeySecret,
          paymentIntentClientSecret,
          subscriptionId,
        } = paymentSheetResponse.data || {};

        if (!paymentIntentClientSecret || !customerId || !ephemeralKeySecret) {
          throw new Error('Stripe payment sheet configuration is incomplete.');
        }

        const initResult = await initPaymentSheet({
          customerId,
          customerEphemeralKeySecret: ephemeralKeySecret,
          paymentIntentClientSecret,
          merchantDisplayName: 'Coffee Rider',
          returnURL: paymentSheetReturnUrl,
        });

        if (initResult.error) {
          throw new Error(initResult.error.message || 'Unable to open payment sheet.');
        }

        setStatus('ready');

        const presentResult = await presentPaymentSheet({ clientSecret: paymentIntentClientSecret });
        if (presentResult.error) {
          const wasCancelled = presentResult.error.code === 'Canceled' || presentResult.error.code === 'CanceledByUser';
          if (wasCancelled) {
            console.info('[Stripe] Payment sheet cancelled by user');
            setStatus('idle');
            setError(null);
            return { cancelled: true };
          }

          throw new Error(presentResult.error.message || 'Payment failed.');
        }

        setStatus('completed');
        return { subscriptionId };
      } catch (err) {
        console.error('[Stripe] Subscription error:', err);
        setStatus('error');
        setError(err);
        throw err;
      }
    },
    [initPaymentSheet, paymentSheetReturnUrl, planLookup, presentPaymentSheet]
  );

  const cancelPaidSubscription = useCallback(async (stripeSubscriptionId) => {
    if (!stripeSubscriptionId) {
      throw new Error('No Stripe subscription ID provided.');
    }

    const result = await cancelStripeSubscriptionCallable({ stripeSubscriptionId });
    return result.data;
  }, []);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    status,
    error,
    subscribeToPlan,
    cancelPaidSubscription,
    resetStatus,
  };
}

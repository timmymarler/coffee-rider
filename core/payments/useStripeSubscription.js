import { functions } from '@config/firebase';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { SUBSCRIPTION_PLANS } from './stripeService';

const formatMinorUnits = (minorUnits, currency) => {
  const amount = (typeof minorUnits === 'number' ? minorUnits : 0) / 100;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: (currency || 'gbp').toUpperCase(),
    }).format(amount);
  } catch (_err) {
    return `£${amount.toFixed(2)}`;
  }
};

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

        const paymentSheetResponse = await createPaymentSheetCallable({
          planId: normalizedPlanId,
          collectWithSetupIntent: true,
        });
        const {
          customerId,
          ephemeralKeySecret,
          paymentIntentClientSecret,
          setupIntentClientSecret,
          subscriptionId,
          trialApplied,
          trialEndsAt,
          priceAmount,
          priceCurrency,
          priceInterval,
        } = paymentSheetResponse.data || {};

        if ((!paymentIntentClientSecret && !setupIntentClientSecret) || !customerId || !ephemeralKeySecret) {
          throw new Error('Stripe payment sheet configuration is incomplete.');
        }

        // Google Play subscriptions policy: state the exact charge terms
        // (price, currency, trial) immediately before the payment sheet.
        const formattedPrice = formatMinorUnits(priceAmount, priceCurrency);
        const currencyLabel = (priceCurrency || 'gbp').toUpperCase();
        const intervalText =
          priceInterval === 'year'
            ? 'per year'
            : priceInterval === 'month'
              ? 'per month'
              : priceInterval === 'day'
                ? 'per day'
                : 'per period';
        const trialEndLabel = trialEndsAt
          ? new Date(trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          : null;
        const termsText =
          trialApplied && trialEndLabel
            ? `£0.00 charged today — your 30-day free trial starts now.\n\nOn ${trialEndLabel} your card will be charged ${formattedPrice} ${intervalText} (${currencyLabel}), renewing automatically until you cancel.\n\nCancel anytime in the app before ${trialEndLabel} to pay nothing.`
            : `Your card will be charged ${formattedPrice} ${intervalText} (${currencyLabel}) today, renewing automatically until you cancel.\n\nCancel anytime in the app.`;

        const confirmed = await new Promise((resolve) => {
          Alert.alert(
            trialApplied ? 'Start your 30-day free trial' : 'Confirm your subscription',
            termsText,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: trialApplied ? 'Start free trial' : `Pay ${formattedPrice}`, onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
          );
        });
        if (!confirmed) {
          setStatus('idle');
          return { cancelled: true };
        }

        const intentSecret = paymentIntentClientSecret || setupIntentClientSecret;
        const initResult = await initPaymentSheet({
          customerId,
          customerEphemeralKeySecret: ephemeralKeySecret,
          ...(paymentIntentClientSecret
            ? { paymentIntentClientSecret }
            : { setupIntentClientSecret }),
          merchantDisplayName: 'Coffee Rider',
          returnURL: paymentSheetReturnUrl,
        });

        if (initResult.error) {
          throw new Error(initResult.error.message || 'Unable to open payment sheet.');
        }

        setStatus('ready');

        const presentResult = await presentPaymentSheet({ clientSecret: intentSecret });
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

// core/payments/stripeService.js
import { db } from '@config/firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Stripe subscription products
 * Replace with actual Stripe product IDs when account is set up
 */
export const STRIPE_PRODUCTS = {
  MONTHLY: 'price_1234567890', // £2.99/month
  ANNUAL: 'price_0987654321',  // £29.99/year
};

export const SUBSCRIPTION_PLANS = {
  MONTHLY: {
    id: 'monthly',
    name: 'Monthly',
    price: '£2.99',
    period: 'per month',
    priceInCents: 299,
    stripePrice: STRIPE_PRODUCTS.MONTHLY,
  },
  ANNUAL: {
    id: 'annual',
    name: 'Annual',
    price: '£29.99',
    period: 'per year',
    priceInCents: 2999,
    stripePrice: STRIPE_PRODUCTS.ANNUAL,
    savingsPercent: 17, // (1 - 29.99/(2.99*12)) * 100
  },
};

/**
 * Create a payment intent for a subscription
 * In production, this would call a Cloud Function to handle Stripe
 */
export async function createPaymentIntent({ userId, plan, email }) {
  if (!userId || !plan) {
    throw new Error('userId and plan are required');
  }

  try {
    // Call Cloud Function to create Stripe payment intent
    // For now, we'll structure the data locally
    const paymentRef = await addDoc(
      collection(db, 'users', userId, 'payments'),
      {
        plan: plan.id,
        amount: plan.priceInCents,
        currency: 'gbp',
        email,
        status: 'pending',
        createdAt: serverTimestamp(),
      }
    );

    return {
      paymentId: paymentRef.id,
      clientSecret: null, // Would be returned from Cloud Function
    };
  } catch (err) {
    console.error('[Stripe] Error creating payment intent:', err);
    throw err;
  }
}

/**
 * Start a free trial for the user (7-day trial without payment)
 */
export async function startFreeTrial({ userId, email }) {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Check if user has already had a trial or been subscribed before
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      // If user has trialStartedAt or subscriptionStatus that's not null/empty, they've already used a trial
      if (userData.trialStartedAt || (userData.subscriptionStatus && userData.subscriptionStatus !== 'free')) {
        throw new Error('You have already used a free trial. Please subscribe to continue using Pro features.');
      }
    }

    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7-day free trial

    await setDoc(
      doc(db, 'users', userId, 'subscription', 'current'),
      {
        status: 'trial',
        plan: 'free-trial',
        trialStartsAt: serverTimestamp(),
        trialEndsAt: trialEndDate.getTime(), // Store as milliseconds timestamp (numeric)
        email,
        createdAt: serverTimestamp(),
      }
    );

    // Update user profile with trial info
    await updateDoc(doc(db, 'users', userId), {
      role: 'pro',
      subscriptionStatus: 'trial',
      subscriptionExpiresAt: trialEndDate.getTime(), // Store as milliseconds
      trialStartedAt: serverTimestamp(),
    });

    return {
      status: 'trial',
      trialEndsAt: trialEndDate,
    };
  } catch (err) {
    // Only log as error if it's an unexpected error (not a validation message)
    if (!err.message.includes('already used a free trial')) {
      console.error('[Stripe] Error starting trial:', err);
    }
    throw err;
  }
}

/**
 * Handle successful subscription payment
 * Called after Stripe confirms payment
 * @param isFromTrial - true if user is subscribing after a 7-day trial (no additional free period)
 */
export async function activateSubscription({
  userId,
  plan,
  stripeSubscriptionId,
  email,
  isFromTrial = false,
}) {
  if (!userId || !plan || !stripeSubscriptionId) {
    throw new Error('userId, plan, and stripeSubscriptionId are required');
  }

  try {
    const renewalDate = new Date();
    const subscriptionData = {
      status: 'active',
      plan: plan.id,
      stripeSubscriptionId,
      renewalDate: renewalDate.getTime(), // Store as milliseconds timestamp
      email,
      createdAt: serverTimestamp(),
      lastRenewal: serverTimestamp(),
    };

    // Only add 30-day free trial for Monthly plan if they're NOT coming from a 7-day trial
    // Annual plan does not include a free trial period (emphasis is on "12 months for price of 10")
    if (!isFromTrial && plan.id === 'monthly') {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30-day free trial for new monthly subscribers
      subscriptionData.trialEndsAt = trialEndsAt.getTime(); // Store as milliseconds
    }
    
    // Calculate renewal date based on plan
    if (plan.id === 'monthly') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else if (plan.id === 'annual') {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    await setDoc(
      doc(db, 'users', userId, 'subscription', 'current'),
      subscriptionData
    );

    // Update user profile with subscription info
    await updateDoc(doc(db, 'users', userId), {
      role: 'pro',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: renewalDate.getTime(), // Store as milliseconds
      subscriptionPlan: plan.id,
    });

    return {
      status: 'active',
      plan: plan.id,
      renewalDate,
    };
  } catch (err) {
    console.error('[Stripe] Error activating subscription:', err);
    throw err;
  }
}

/**
 * Cancel a subscription
 * Called when user wants to cancel their active subscription
 */
export async function cancelSubscription({ userId, stripeSubscriptionId }) {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Update subscription status to cancelled
    await setDoc(
      doc(db, 'users', userId, 'subscription', 'current'),
      {
        status: 'cancelled',
        stripeSubscriptionId: stripeSubscriptionId || null,
        cancelledAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Update user profile to reflect cancellation (back to 'user' role)
    await updateDoc(doc(db, 'users', userId), {
      role: 'user',
      subscriptionStatus: 'cancelled',
      subscriptionExpiresAt: null,
    });

    // If this is a paid subscription (has stripeSubscriptionId), call Cloud Function to cancel with Stripe
    if (stripeSubscriptionId) {
      // TODO: Implement Cloud Function to handle Stripe cancellation
      // POST /cancelSubscription with { userId, stripeSubscriptionId }
    }

    return {
      status: 'cancelled',
      message: 'Subscription cancelled successfully',
    };
  } catch (err) {
    console.error('[Stripe] Error cancelling subscription:', err);
    throw err;
  }
}

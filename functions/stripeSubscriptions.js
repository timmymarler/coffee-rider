import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import Stripe from 'stripe';

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'us-central1';
const RUNTIME_OPTS = {
  timeoutSeconds: 120,
  memory: '512MB',
};

const readEnv = (key) => {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
};

const STRIPE_API_VERSION = '2024-06-20';

const getStripeSecretKey = () => {
  const key = readEnv('STRIPE_LIVE_SECRET_KEY') || readEnv('STRIPE_TEST_SECRET_KEY');
  if (!key) {
    throw new Error('Stripe secret key is not configured.');
  }
  return key;
};

let stripeClient = null;
const getStripe = () => {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey(), {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return stripeClient;
};

const getPriceId = (plan) => {
  const normalized = plan === 'annual' ? 'ANNUAL' : 'MONTHLY';
  return (
    readEnv(`STRIPE_LIVE_PRICE_${normalized}`) || readEnv(`STRIPE_TEST_PRICE_${normalized}`)
  );
};

const getWebhookSecret = () =>
  readEnv('STRIPE_LIVE_WEBHOOK_SECRET') || readEnv('STRIPE_TEST_WEBHOOK_SECRET');

const firestore = admin.firestore();
const { FieldValue } = admin.firestore;

const upsertSubscriptionDocument = async (uid, data) => {
  const subRef = firestore.doc(`users/${uid}/subscription/current`);
  await subRef.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      ...data,
    },
    { merge: true }
  );
};

const updateUserProfile = async (uid, data) => {
  const userRef = firestore.doc(`users/${uid}`);
  await userRef.set(data, { merge: true });
};

const ensureCustomerForUid = async (uid) => {
  const userRef = firestore.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};

  if (userData?.stripeCustomerId) {
    return userData.stripeCustomerId;
  }

  const authUser = await admin.auth().getUser(uid);
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: authUser.email || userData?.email || undefined,
    name: authUser.displayName || userData?.displayName || undefined,
    metadata: { firebaseUID: uid },
  });

  await userRef.set(
    {
      stripeCustomerId: customer.id,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return customer.id;
};

const mapStripeStatus = (status) => {
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const handleSubscriptionSync = async (subscription) => {
  const uid = subscription.metadata?.firebaseUID;
  if (!uid) {
    functions.logger.warn('Subscription missing firebaseUID metadata', subscription.id);
    return;
  }

  const planId = subscription.metadata?.planId || subscription.items?.data?.[0]?.price?.metadata?.planId || 'monthly';
  const renewalDate = subscription.current_period_end ? subscription.current_period_end * 1000 : null;
  const status = mapStripeStatus(subscription.status);

  await upsertSubscriptionDocument(uid, {
    status,
    plan: planId,
    stripeSubscriptionId: subscription.id,
    renewalDate,
  });

  await updateUserProfile(uid, {
    role: status === 'active' ? 'pro' : 'user',
    subscriptionStatus: status,
    subscriptionPlan: planId,
    subscriptionExpiresAt: renewalDate,
  });
};

export const ensureStripeCustomer = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (_data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const customerId = await ensureCustomerForUid(context.auth.uid);
    return { customerId };
  });

export const createSubscriptionPaymentSheet = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const planId = (data?.planId || '').toLowerCase();
    const priceId = getPriceId(planId);
    if (!priceId) {
      throw new functions.https.HttpsError('invalid-argument', 'Unknown plan selected.');
    }

    const customerId = await ensureCustomerForUid(context.auth.uid);
    const stripe = getStripe();
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2024-06-20' }
    );

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        firebaseUID: context.auth.uid,
        planId,
      },
    });

    const paymentIntent = subscription.latest_invoice?.payment_intent;
    if (!paymentIntent?.client_secret) {
      throw new functions.https.HttpsError('internal', 'Failed to create a payment intent.');
    }

    await upsertSubscriptionDocument(context.auth.uid, {
      status: 'pending',
      plan: planId,
      stripeSubscriptionId: subscription.id,
    });

    await updateUserProfile(context.auth.uid, {
      subscriptionStatus: 'pending',
      subscriptionPlan: planId,
    });

    return {
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
      paymentIntentClientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
    };
  });

export const cancelStripeSubscription = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const subscriptionId = data?.stripeSubscriptionId;
    if (!subscriptionId) {
      throw new functions.https.HttpsError('invalid-argument', 'stripeSubscriptionId is required');
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.metadata?.firebaseUID !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Subscription does not belong to this user.');
    }

    await stripe.subscriptions.cancel(subscriptionId);

    await upsertSubscriptionDocument(context.auth.uid, {
      status: 'cancelled',
      stripeSubscriptionId: subscriptionId,
      cancelledAt: FieldValue.serverTimestamp(),
    });

    await updateUserProfile(context.auth.uid, {
      role: 'user',
      subscriptionStatus: 'cancelled',
      subscriptionExpiresAt: null,
    });

    return { status: 'cancelled' };
  });

export const stripeWebhook = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const webhookSecret = getWebhookSecret();
    if (!webhookSecret) {
      res.status(500).send('Webhook secret not configured');
      return;
    }

    const signature = req.headers['stripe-signature'];
    let event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err) {
      functions.logger.error('Stripe webhook signature verification failed', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      const stripe = getStripe();
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionSync(event.data.object);
          break;
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
          if (event.data.object.subscription) {
            const latestSubscription = await stripe.subscriptions.retrieve(event.data.object.subscription);
            await handleSubscriptionSync(latestSubscription);
          }
          break;
        default:
          break;
      }

      res.json({ received: true });
    } catch (err) {
      functions.logger.error('Error handling Stripe webhook', err);
      res.status(500).send('Webhook handler failed');
    }
  });

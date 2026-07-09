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

const isLiveMode = () => Boolean(readEnv('STRIPE_LIVE_SECRET_KEY'));

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
  const normalizedPlan = (plan || '').toLowerCase();
  let suffix = 'MONTHLY';
  if (normalizedPlan === 'annual') {
    suffix = 'ANNUAL';
  } else if (normalizedPlan === 'daily') {
    suffix = 'DAILY';
  }

  return readEnv(`STRIPE_LIVE_PRICE_${suffix}`) || readEnv(`STRIPE_TEST_PRICE_${suffix}`);
};

const KNOWN_PLAN_IDS = new Set(['daily', 'monthly', 'annual']);

const normalizePlanId = (plan) => {
  const normalizedPlan = typeof plan === 'string' ? plan.toLowerCase() : null;
  return normalizedPlan && KNOWN_PLAN_IDS.has(normalizedPlan) ? normalizedPlan : null;
};

const resolvePlanIdFromPriceId = (priceId) => {
  if (!priceId) return null;

  for (const plan of KNOWN_PLAN_IDS) {
    if (getPriceId(plan) === priceId) {
      return plan;
    }
  }

  return null;
};

const resolveStripePlanId = ({ subscription, existingSub }) => {
  const metadataPlanId = normalizePlanId(subscription.metadata?.planId);
  if (metadataPlanId) {
    return metadataPlanId;
  }

  const price = subscription.items?.data?.[0]?.price || null;
  const priceMetadataPlanId = normalizePlanId(price?.metadata?.planId);
  if (priceMetadataPlanId) {
    return priceMetadataPlanId;
  }

  const priceIdPlan = resolvePlanIdFromPriceId(price?.id);
  if (priceIdPlan) {
    return priceIdPlan;
  }

  const existingPlanId = normalizePlanId(existingSub?.plan);
  if (
    existingSub?.provider === 'stripe' &&
    existingSub?.stripeSubscriptionId === subscription.id &&
    existingPlanId
  ) {
    return existingPlanId;
  }

  return null;
};

const getWebhookSecret = () =>
  readEnv('STRIPE_LIVE_WEBHOOK_SECRET') || readEnv('STRIPE_TEST_WEBHOOK_SECRET');

const firestore = admin.firestore();
const { FieldValue } = admin.firestore;
const PROTECTED_ROLES = new Set(['admin', 'place-owner']);

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

const getRoleForSubscriptionStatus = (status) => {
  if (status === 'active' || status === 'trial') {
    return 'pro';
  }

  return 'user';
};

const syncSubscriptionRole = async (uid, status, extraUpdates = {}) => {
  const userRef = firestore.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const currentRole = userSnap.exists ? userSnap.data()?.role : null;
  const updates = { ...extraUpdates };

  if (!PROTECTED_ROLES.has(currentRole)) {
    const nextRole = getRoleForSubscriptionStatus(status);
    if (nextRole && currentRole !== nextRole) {
      updates.role = nextRole;
    }
  }

  await updateUserProfile(uid, updates);
};

const ensureCustomerForUid = async (uid) => {
  const userRef = firestore.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};

  const customerField = isLiveMode() ? 'stripeCustomerId' : 'stripeCustomerIdTest';
  if (userData?.[customerField]) {
    return userData[customerField];
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
      [customerField]: customer.id,
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

const resolveUidByCustomerId = async (customerId) => {
  if (!customerId) return null;

  try {
    const fieldsToCheck = ['stripeCustomerId', 'stripeCustomerIdTest'];
    for (const field of fieldsToCheck) {
      const snapshot = await firestore.collection('users').where(field, '==', customerId).limit(1).get();
      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }
    }
  } catch (err) {
    functions.logger.error('Failed to resolve UID via customer lookup', {
      customerId,
      message: err?.message || String(err),
    });
  }

  return null;
};

const resolveUidForSubscription = async (subscription) => {
  if (subscription.metadata?.firebaseUID) {
    return subscription.metadata.firebaseUID;
  }

  try {
    const snapshot = await firestore
      .collectionGroup('subscription')
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const userDocRef = snapshot.docs[0].ref.parent.parent;
      return userDocRef?.id || null;
    }
  } catch (err) {
    functions.logger.error('Failed to resolve UID via collectionGroup lookup', err);
  }

  const uidFromCustomer = await resolveUidByCustomerId(subscription.customer);
  if (uidFromCustomer) {
    return uidFromCustomer;
  }

  return null;
};

const handleSubscriptionSync = async (subscription) => {
  const uid = await resolveUidForSubscription(subscription);
  if (!uid) {
    functions.logger.warn('Subscription missing firebaseUID metadata', subscription.id);
    return;
  }

  const existingSubRef = firestore.doc(`users/${uid}/subscription/current`);
  const existingSubSnap = await existingSubRef.get();
  const existingSub = existingSubSnap.exists ? existingSubSnap.data() : null;

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const resolvedPlanId = resolveStripePlanId({ subscription, existingSub });
  const existingPlanId = normalizePlanId(existingSub?.plan);
  const nextPlanId = resolvedPlanId || existingPlanId;
  const currentPeriodEnd =
    subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || null;
  const renewalDate = currentPeriodEnd
    ? currentPeriodEnd * 1000
    : null; // Stripe sometimes nests period info on the item
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const cancellationEffectiveDate = cancelAtPeriodEnd && renewalDate ? renewalDate : null;
  const status = mapStripeStatus(subscription.status);

  // Stripe can emit non-active states for stale/incomplete subscriptions.
  // Do not downgrade a still-valid active/trial Stripe record to pending.
  if (
    status === 'pending' &&
    existingSub?.provider === 'stripe' &&
    (existingSub?.status === 'active' || existingSub?.status === 'trial')
  ) {
    const existingRenewalMs =
      typeof existingSub?.renewalDate === 'number'
        ? existingSub.renewalDate
        : typeof existingSub?.subscriptionExpiresAt === 'number'
          ? existingSub.subscriptionExpiresAt
          : null;
    const hasFutureExpiry = Number.isFinite(existingRenewalMs) ? existingRenewalMs > Date.now() : true;

    if (hasFutureExpiry) {
      functions.logger.warn('Ignoring pending downgrade for still-active Stripe subscription', {
        uid,
        incomingSubscriptionId: subscription.id,
        incomingStripeStatus: subscription.status,
        existingStatus: existingSub.status,
        existingSubscriptionId: existingSub.stripeSubscriptionId || null,
      });
      return;
    }
  }

  functions.logger.info('Syncing subscription state', {
    uid,
    subscriptionId: subscription.id,
    status,
    resolvedPlanId: resolvedPlanId || null,
    existingPlanId: existingPlanId || null,
    priceId,
  });

  if (!resolvedPlanId) {
    functions.logger.warn('Stripe subscription plan could not be resolved from incoming data', {
      uid,
      subscriptionId: subscription.id,
      priceId,
      metadataPlanId: subscription.metadata?.planId || null,
      priceMetadataPlanId: subscription.items?.data?.[0]?.price?.metadata?.planId || null,
      existingPlanId: existingPlanId || null,
    });
  }

  if (
    resolvedPlanId &&
    existingPlanId &&
    resolvedPlanId !== existingPlanId &&
    existingSub?.provider === 'stripe'
  ) {
    functions.logger.warn('Stripe subscription plan changed during sync', {
      uid,
      subscriptionId: subscription.id,
      existingPlanId,
      resolvedPlanId,
      priceId,
    });
  }

  const subscriptionUpdate = {
    status,
    provider: 'stripe',
    stripeSubscriptionId: subscription.id,
    renewalDate,
    cancelAtPeriodEnd,
    cancellationEffectiveDate,
  };
  if (nextPlanId) {
    subscriptionUpdate.plan = nextPlanId;
  }

  await upsertSubscriptionDocument(uid, subscriptionUpdate);

  const profileUpdate = {
    subscriptionStatus: status,
    subscriptionExpiresAt: renewalDate,
    subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
  };
  if (nextPlanId) {
    profileUpdate.subscriptionPlan = nextPlanId;
  }

  await syncSubscriptionRole(uid, status, profileUpdate);
};

const getKnownCustomerIdForUid = async (uid) => {
  const userSnap = await firestore.doc(`users/${uid}`).get();
  const userData = userSnap.exists ? userSnap.data() : null;
  return userData?.stripeCustomerId || userData?.stripeCustomerIdTest || null;
};

const pickMostRelevantSubscription = (subscriptions = [], preferredId = null) => {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return null;
  }

  if (preferredId) {
    const exact = subscriptions.find((sub) => sub?.id === preferredId);
    if (exact) return exact;
  }

  const rank = {
    trialing: 0,
    active: 0,
    past_due: 1,
    unpaid: 2,
    incomplete: 3,
    incomplete_expired: 4,
    canceled: 5,
  };

  return [...subscriptions].sort((a, b) => {
    const rankA = rank[a?.status] ?? 99;
    const rankB = rank[b?.status] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return (b?.created || 0) - (a?.created || 0);
  })[0];
};

export const syncStripeSubscriptionState = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const uid = context.auth.uid;
    const preferredSubscriptionId = data?.stripeSubscriptionId || null;
    const customerId = await getKnownCustomerIdForUid(uid);

    if (!customerId) {
      functions.logger.info('syncStripeSubscriptionState: no Stripe customer found', { uid });
      return { status: 'none', reason: 'missing_customer' };
    }

    const stripe = getStripe();
    const listed = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    const chosen = pickMostRelevantSubscription(listed?.data || [], preferredSubscriptionId);
    if (!chosen) {
      functions.logger.info('syncStripeSubscriptionState: no subscriptions found', { uid, customerId });
      return { status: 'none', reason: 'no_subscriptions' };
    }

    const subscription = await stripe.subscriptions.retrieve(chosen.id);
    await handleSubscriptionSync(subscription);

    return {
      status: mapStripeStatus(subscription.status),
      stripeStatus: subscription.status,
      stripeSubscriptionId: subscription.id,
    };
  });

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
    const liveSecretKey = readEnv('STRIPE_LIVE_SECRET_KEY');
    const secretKeyPrefix = liveSecretKey ? liveSecretKey.slice(0, 3) : null;
    functions.logger.info('createSubscriptionPaymentSheet invoked', {
      uid: context.auth.uid,
      planId,
      secretKeyPrefix,
      hasLiveSecretKey: Boolean(liveSecretKey),
    });
    const priceId = getPriceId(planId);
    if (!priceId) {
      throw new functions.https.HttpsError('invalid-argument', 'Unknown plan selected.');
    }
    functions.logger.info('Stripe price resolved', { planId, priceId });

    const customerId = await ensureCustomerForUid(context.auth.uid);
    functions.logger.info('Stripe customer ready', { uid: context.auth.uid, customerId });
    const stripe = getStripe();
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2024-06-20' }
    );
    functions.logger.info('Ephemeral key created', { uid: context.auth.uid, customerId });

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
      provider: 'stripe',
      stripeSubscriptionId: subscription.id,
    });
    functions.logger.info('Subscription document updated', {
      uid: context.auth.uid,
      subscriptionId: subscription.id,
      status: 'pending',
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

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    await handleSubscriptionSync(updatedSubscription);

    return {
      status: updatedSubscription.status,
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
    };
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
    functions.logger.info('stripeWebhook invoked', {
      hasLiveSecretKey: Boolean(readEnv('STRIPE_LIVE_SECRET_KEY')),
      hasWebhookSecret: Boolean(webhookSecret),
      headersPresent: Boolean(req.headers['stripe-signature']),
    });
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

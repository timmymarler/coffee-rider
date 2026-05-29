import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'us-central1';
const RUNTIME_OPTS = {
  timeoutSeconds: 120,
  memory: '512MB',
};

const APPLE_VERIFY_URL_PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_URL_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';
const PROTECTED_ROLES = new Set(['admin', 'place-owner']);

const firestore = admin.firestore();
const { FieldValue } = admin.firestore;

const readEnv = (key) => {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  try {
    const cfg = functions.config?.() || {};
    if (key === 'APPLE_SHARED_SECRET' || key === 'APPLE_APP_SHARED_SECRET') {
      const cfgValue = cfg?.apple?.shared_secret || cfg?.apple?.app_shared_secret;
      if (typeof cfgValue === 'string' && cfgValue.trim().length > 0) {
        return cfgValue.trim();
      }
    }
  } catch (_) {
    // Ignore config read failures in local/dev contexts.
  }

  return null;
};

const getSharedSecret = () => {
  const sharedSecret = readEnv('APPLE_SHARED_SECRET') || readEnv('APPLE_APP_SHARED_SECRET');
  if (!sharedSecret) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Apple shared secret is not configured on Cloud Functions.'
    );
  }
  return sharedSecret;
};

const getAppleProductIds = () => {
  return {
    monthly:
      readEnv('EXPO_PUBLIC_APPLE_IAP_MONTHLY_PRODUCT_ID') ||
      'com.timmy.marler.coffeerider.pro.monthly.v2',
    annual:
      readEnv('EXPO_PUBLIC_APPLE_IAP_ANNUAL_PRODUCT_ID') ||
      'com.timmy.marler.coffeerider.pro.annual.v2',
  };
};

const getAppleProductAliases = (productIds) => {
  const aliases = new Set([productIds.monthly, productIds.annual]);

  if (productIds.monthly?.endsWith('.v2')) {
    aliases.add(productIds.monthly.replace(/\.v2$/, ''));
  }
  if (productIds.annual?.endsWith('.v2')) {
    aliases.add(productIds.annual.replace(/\.v2$/, ''));
  }

  return aliases;
};

const isAnnualProductId = (productId, configuredAnnualId) => {
  if (!productId) return false;
  if (productId === configuredAnnualId) return true;
  return productId.includes('.annual');
};

const toMillis = (value) => {
  const parsed = Number.parseInt(String(value || 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const decodeJwsPayload = (signedValue) => {
  if (!signedValue || typeof signedValue !== 'string') return null;

  const parts = signedValue.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4 || 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_err) {
    return null;
  }
};

const resolveUidFromAppleTransaction = async ({ originalTransactionId, transactionId }) => {
  const lookupValues = [
    { field: 'appleOriginalTransactionId', value: originalTransactionId },
    { field: 'appleTransactionId', value: transactionId },
    { field: 'appleTransactionId', value: originalTransactionId },
    { field: 'appleOriginalTransactionId', value: transactionId },
  ].filter((entry) => typeof entry.value === 'string' && entry.value.length > 0);

  for (const lookup of lookupValues) {
    const snap = await firestore
      .collectionGroup('subscription')
      .where(lookup.field, '==', lookup.value)
      .limit(1)
      .get();

    if (!snap.empty) {
      const userRef = snap.docs[0].ref.parent?.parent;
      if (userRef?.id) {
        return userRef.id;
      }
    }
  }

  return null;
};

const deriveNotificationStatus = ({ notificationType, expiresDateMs }) => {
  const now = Date.now();
  const hasFutureExpiry = Number.isFinite(expiresDateMs) && expiresDateMs > now;

  if (notificationType === 'REFUND' || notificationType === 'REVOKE') {
    return 'cancelled';
  }

  if (notificationType === 'EXPIRED') {
    return 'expired';
  }

  if (notificationType === 'DID_FAIL_TO_RENEW' && !hasFutureExpiry) {
    return 'expired';
  }

  return hasFutureExpiry ? 'active' : 'expired';
};

const pickLatestTransaction = ({
  transactions,
  validProductIds,
  transactionId,
  originalTransactionId,
}) => {
  const filtered = transactions
    .filter((txn) => validProductIds.has(txn.product_id))
    .map((txn) => ({
      ...txn,
      expiresMs: toMillis(txn.expires_date_ms),
      purchaseMs: toMillis(txn.purchase_date_ms),
    }));

  const byOriginal = originalTransactionId
    ? filtered.filter(
        (txn) =>
          txn.original_transaction_id === originalTransactionId ||
          txn.transaction_id === originalTransactionId
      )
    : [];

  const byTransaction = transactionId
    ? filtered.filter(
        (txn) =>
          txn.transaction_id === transactionId ||
          txn.original_transaction_id === transactionId
      )
    : [];

  const pool = byOriginal.length > 0 ? byOriginal : byTransaction.length > 0 ? byTransaction : filtered;

  return pool.sort((a, b) => {
    if (b.expiresMs !== a.expiresMs) return b.expiresMs - a.expiresMs;
    return b.purchaseMs - a.purchaseMs;
  })[0];
};

const postVerifyReceipt = async ({ receiptData, sharedSecret, useSandbox }) => {
  const endpoint = useSandbox ? APPLE_VERIFY_URL_SANDBOX : APPLE_VERIFY_URL_PROD;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': true,
    }),
  });

  if (!response.ok) {
    throw new functions.https.HttpsError(
      'internal',
      `Apple verifyReceipt returned HTTP ${response.status}.`
    );
  }

  return response.json();
};

const getRoleForStatus = (status) => {
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
    const nextRole = getRoleForStatus(status);
    if (nextRole && currentRole !== nextRole) {
      updates.role = nextRole;
    }
  }

  await userRef.set(updates, { merge: true });
};

export const activateAppleSubscription = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const uid = context.auth.uid;
    const {
      productId,
      transactionId,
      originalTransactionId,
      purchaseDateMs,
      receiptData,
      email,
    } = data || {};

    if (!receiptData || typeof receiptData !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'receiptData is required for Apple subscription validation.'
      );
    }

    if (!productId || !transactionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'productId and transactionId are required.'
      );
    }

    const sharedSecret = getSharedSecret();
    let verifyPayload = await postVerifyReceipt({
      receiptData,
      sharedSecret,
      useSandbox: false,
    });

    // 21007 means sandbox receipt sent to production endpoint.
    if (verifyPayload?.status === 21007) {
      verifyPayload = await postVerifyReceipt({
        receiptData,
        sharedSecret,
        useSandbox: true,
      });
    }

    if (verifyPayload?.status !== 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Apple receipt validation failed with status ${verifyPayload?.status}.`
      );
    }

    const receiptTransactions = [
      ...(Array.isArray(verifyPayload?.latest_receipt_info)
        ? verifyPayload.latest_receipt_info
        : []),
      ...(Array.isArray(verifyPayload?.receipt?.in_app) ? verifyPayload.receipt.in_app : []),
    ];

    if (receiptTransactions.length === 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Apple receipt did not include any in-app purchase records.'
      );
    }

    const productIds = getAppleProductIds();
    const validProductIds = getAppleProductAliases(productIds);

    const latestTxn = pickLatestTransaction({
      transactions: receiptTransactions,
      validProductIds,
      transactionId,
      originalTransactionId,
    });

    if (!latestTxn) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No valid Apple subscription transaction found for configured product IDs.'
      );
    }

    const plan = isAnnualProductId(latestTxn.product_id, productIds.annual) ? 'annual' : 'monthly';
    const renewalDateMs = toMillis(latestTxn.expires_date_ms);
    const purchaseMs = toMillis(latestTxn.purchase_date_ms) || toMillis(purchaseDateMs) || Date.now();
    const now = Date.now();
    const status = renewalDateMs > now ? 'active' : 'expired';

    await firestore
      .doc(`users/${uid}/subscription/current`)
      .set(
        {
          status,
          plan,
          provider: 'apple_iap',
          appleProductId: latestTxn.product_id,
          appleTransactionId: latestTxn.transaction_id || transactionId,
          appleOriginalTransactionId:
            latestTxn.original_transaction_id || originalTransactionId || transactionId,
          purchaseDate: purchaseMs,
          renewalDate: renewalDateMs || null,
          appleReceiptEnvironment: verifyPayload?.environment || null,
          appleReceiptStatusCode: verifyPayload?.status,
          email: email || null,
          updatedAt: FieldValue.serverTimestamp(),
          lastRenewal: status === 'active' ? FieldValue.serverTimestamp() : null,
        },
        { merge: true }
      );

    await syncSubscriptionRole(uid, status, {
      subscriptionStatus: status,
      subscriptionPlan: status === 'active' ? plan : null,
      subscriptionExpiresAt: status === 'active' ? renewalDateMs : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      status,
      plan,
      renewalDate: renewalDateMs || null,
      environment: verifyPayload?.environment || null,
    };
  });

export const appleServerNotification = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const signedPayload = req.body?.signedPayload;
      if (!signedPayload || typeof signedPayload !== 'string') {
        res.status(400).send('signedPayload is required');
        return;
      }

      const envelope = decodeJwsPayload(signedPayload);
      if (!envelope) {
        res.status(400).send('Invalid signedPayload format');
        return;
      }

      const notificationUUID = envelope.notificationUUID || null;
      if (notificationUUID) {
        const notifRef = firestore.doc(`appleNotifications/${notificationUUID}`);
        const existing = await notifRef.get();
        if (existing.exists) {
          res.status(200).json({ received: true, duplicate: true });
          return;
        }
      }

      const notificationType = envelope.notificationType || null;
      const subtype = envelope.subtype || null;
      const data = envelope.data || {};

      const transactionPayload = decodeJwsPayload(data.signedTransactionInfo) || {};
      const renewalPayload = decodeJwsPayload(data.signedRenewalInfo) || {};

      const productId =
        transactionPayload.productId ||
        renewalPayload.productId ||
        data.productId ||
        null;

      const transactionId =
        transactionPayload.transactionId ||
        data.transactionId ||
        null;

      const originalTransactionId =
        transactionPayload.originalTransactionId ||
        renewalPayload.originalTransactionId ||
        data.originalTransactionId ||
        null;

      const expiresDateMs = toMillis(
        transactionPayload.expiresDate || renewalPayload.gracePeriodExpiresDate
      );
      const purchaseDateMs = toMillis(transactionPayload.purchaseDate);

      const expectedBundleId =
        readEnv('IOS_BUNDLE_IDENTIFIER') || 'com.timmy.marler.coffeerider';
      const bundleId =
        transactionPayload.bundleId ||
        renewalPayload.bundleId ||
        data.bundleId ||
        null;

      if (bundleId && bundleId !== expectedBundleId) {
        res.status(403).send('Bundle identifier mismatch');
        return;
      }

      const productIds = getAppleProductIds();
      const validProducts = getAppleProductAliases(productIds);
      if (!productId || !validProducts.has(productId)) {
        if (notificationUUID) {
          await firestore.doc(`appleNotifications/${notificationUUID}`).set({
            createdAt: FieldValue.serverTimestamp(),
            notificationType,
            subtype,
            ignoredReason: 'unknown_product_id',
            productId: productId || null,
          });
        }
        res.status(200).json({ received: true, ignored: true });
        return;
      }

      const uid = await resolveUidFromAppleTransaction({
        originalTransactionId,
        transactionId,
      });

      if (!uid) {
        if (notificationUUID) {
          await firestore.doc(`appleNotifications/${notificationUUID}`).set({
            createdAt: FieldValue.serverTimestamp(),
            notificationType,
            subtype,
            unresolved: true,
            productId,
            transactionId: transactionId || null,
            originalTransactionId: originalTransactionId || null,
          });
        }
        res.status(200).json({ received: true, unresolved: true });
        return;
      }

      const plan = isAnnualProductId(productId, productIds.annual) ? 'annual' : 'monthly';
      const status = deriveNotificationStatus({ notificationType, expiresDateMs });

      await firestore.doc(`users/${uid}/subscription/current`).set(
        {
          status,
          plan: status === 'active' ? plan : plan,
          provider: 'apple_iap',
          appleProductId: productId,
          appleTransactionId: transactionId || null,
          appleOriginalTransactionId: originalTransactionId || transactionId || null,
          purchaseDate: purchaseDateMs || null,
          renewalDate: expiresDateMs || null,
          appleNotificationType: notificationType,
          appleNotificationSubtype: subtype,
          appleNotificationUUID: notificationUUID,
          appleNotificationEnvironment: envelope.environment || null,
          updatedAt: FieldValue.serverTimestamp(),
          lastRenewal: status === 'active' ? FieldValue.serverTimestamp() : null,
        },
        { merge: true }
      );

      await syncSubscriptionRole(uid, status, {
        subscriptionStatus: status,
        subscriptionPlan: status === 'active' ? plan : null,
        subscriptionExpiresAt: status === 'active' ? expiresDateMs || null : null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (notificationUUID) {
        await firestore.doc(`appleNotifications/${notificationUUID}`).set({
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
          uid,
          productId,
          transactionId: transactionId || null,
          originalTransactionId: originalTransactionId || null,
          notificationType,
          subtype,
          status,
          expiresDateMs: expiresDateMs || null,
        });
      }

      res.status(200).json({ received: true });
    } catch (err) {
      functions.logger.error('appleServerNotification failed', err);
      res.status(500).send('Notification handling failed');
    }
  });

import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { subtle } from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'us-central1';
const RUNTIME_OPTS = {
  timeoutSeconds: 120,
  memory: '512MB',
};

const APPLE_API_BASE_PROD = 'https://api.storekit.itunes.apple.com';
const APPLE_API_BASE_SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';
const BUNDLE_ID = 'com.timmy.marler.coffeerider';
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

const getAppStoreConfig = () => {
  let keyId, issuerId, privateKeyB64;
  try {
    const cfg = functions.config?.() || {};
    keyId = cfg?.apple?.key_id || process.env.APPLE_KEY_ID;
    issuerId = cfg?.apple?.issuer_id || process.env.APPLE_ISSUER_ID;
    privateKeyB64 = cfg?.apple?.private_key_b64 || process.env.APPLE_PRIVATE_KEY_B64;
  } catch (_) {
    keyId = process.env.APPLE_KEY_ID;
    issuerId = process.env.APPLE_ISSUER_ID;
    privateKeyB64 = process.env.APPLE_PRIVATE_KEY_B64;
  }
  if (!keyId || !issuerId || !privateKeyB64) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Apple App Store Server API credentials not configured.'
    );
  }
  return { keyId, issuerId, privateKey: Buffer.from(privateKeyB64, 'base64').toString('utf8') };
};

const makeAppStoreJwt = async ({ privateKey, keyId, issuerId }) => {
  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const keyBuffer = Buffer.from(pemContents, 'base64');
  const cryptoKey = await subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 3600,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const sigBuffer = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    Buffer.from(signingInput)
  );
  return `${signingInput}.${Buffer.from(sigBuffer).toString('base64url')}`;
};

const fetchSubscriptionStatus = async ({ originalTransactionId, jwt, useSandbox }) => {
  const base = useSandbox ? APPLE_API_BASE_SANDBOX : APPLE_API_BASE_PROD;
  const url = `${base}/inApps/v1/subscriptions/${originalTransactionId}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  return { httpStatus: response.status, body: response.ok ? await response.json() : null };
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
    try {
      if (!context.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
      }

      const uid = context.auth.uid;
      const { productId, transactionId, originalTransactionId, purchaseDateMs, email } = data || {};

      if (!productId || !transactionId) {
        functions.logger.error('activateAppleSubscription missing identifiers', {
          uid, productId, transactionId, originalTransactionId,
        });
        throw new functions.https.HttpsError(
          'invalid-argument',
          'productId and transactionId are required.'
        );
      }

      const { keyId, issuerId, privateKey } = getAppStoreConfig();
      const jwt = await makeAppStoreJwt({ privateKey, keyId, issuerId });
      const origTxnId = originalTransactionId || transactionId;

      // Try production first; TestFlight / sandbox purchases return 404 on prod endpoint.
      let apiResult = await fetchSubscriptionStatus({ originalTransactionId: origTxnId, jwt, useSandbox: false });
      if (apiResult.httpStatus === 404) {
        apiResult = await fetchSubscriptionStatus({ originalTransactionId: origTxnId, jwt, useSandbox: true });
      }

      if (!apiResult.body) {
        functions.logger.error('App Store Server API error', {
          uid, httpStatus: apiResult.httpStatus, origTxnId, productId,
        });
        throw new functions.https.HttpsError(
          'failed-precondition',
          `App Store Server API returned HTTP ${apiResult.httpStatus}.`
        );
      }

      const productIds = getAppleProductIds();
      const validProductIds = getAppleProductAliases(productIds);
      const groups = apiResult.body?.data || [];

      let matchedApiStatus = null;
      let matchedTxnPayload = null;
      outer: for (const group of groups) {
        for (const lastTxn of (group.lastTransactions || [])) {
          const txnPayload = decodeJwsPayload(lastTxn.signedTransactionInfo);
          if (txnPayload && validProductIds.has(txnPayload.productId)) {
            matchedApiStatus = lastTxn.status;
            matchedTxnPayload = txnPayload;
            break outer;
          }
        }
      }

      if (!matchedTxnPayload) {
        functions.logger.error('No matching subscription in App Store API response', {
          uid, origTxnId, productId,
          configuredMonthlyId: productIds.monthly,
          configuredAnnualId: productIds.annual,
        });
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No valid Apple subscription transaction found for configured product IDs.'
        );
      }

      // API status: 1=active, 3=billing retry, 4=grace period -> active; 2=expired, 5=revoked -> expired
      const normalizedApiStatus = Number.parseInt(String(matchedApiStatus), 10);
      const renewalDateMs = matchedTxnPayload.expiresDate ? Number(matchedTxnPayload.expiresDate) : null;
      const hasFutureExpiry = Number.isFinite(renewalDateMs) && renewalDateMs > Date.now();
      const isActiveByStatus =
        normalizedApiStatus === 1 || normalizedApiStatus === 3 || normalizedApiStatus === 4;
      const status = isActiveByStatus || hasFutureExpiry ? 'active' : 'expired';
      const plan = isAnnualProductId(matchedTxnPayload.productId, productIds.annual) ? 'annual' : 'monthly';
      const purchaseMs = matchedTxnPayload.purchaseDate
        ? Number(matchedTxnPayload.purchaseDate)
        : (purchaseDateMs || Date.now());

      functions.logger.info('Apple subscription sync result', {
        uid,
        productId: matchedTxnPayload.productId,
        transactionId: matchedTxnPayload.transactionId || transactionId,
        originalTransactionId: matchedTxnPayload.originalTransactionId || origTxnId,
        apiStatusRaw: matchedApiStatus,
        apiStatusNormalized: Number.isFinite(normalizedApiStatus) ? normalizedApiStatus : null,
        renewalDateMs: Number.isFinite(renewalDateMs) ? renewalDateMs : null,
        status,
        environment: apiResult.body?.environment || null,
      });

      await firestore
        .doc(`users/${uid}/subscription/current`)
        .set(
          {
            status,
            plan,
            provider: 'apple_iap',
            appleProductId: matchedTxnPayload.productId,
            appleTransactionId: matchedTxnPayload.transactionId || transactionId,
            appleOriginalTransactionId: matchedTxnPayload.originalTransactionId || origTxnId,
            purchaseDate: purchaseMs,
            renewalDate: renewalDateMs || null,
            appleReceiptEnvironment: apiResult.body?.environment || null,
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
        environment: apiResult.body?.environment || null,
      };
    } catch (err) {
      functions.logger.error('activateAppleSubscription failed', {
        uid: context.auth?.uid || null,
        code: err?.code || null,
        message: err?.message || String(err),
        hasProductId: Boolean(data?.productId),
        hasTransactionId: Boolean(data?.transactionId),
        hasOriginalTransactionId: Boolean(data?.originalTransactionId),
        hasReceiptData: Boolean(data?.receiptData),
      });

      if (err instanceof functions.https.HttpsError) {
        throw err;
      }

      throw new functions.https.HttpsError('internal', err?.message || 'Apple activation failed.');
    }
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

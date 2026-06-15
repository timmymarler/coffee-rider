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
const APPLE_VERIFY_RECEIPT_PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_RECEIPT_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';
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

const verifyReceiptWithApple = async ({ receiptData, sharedSecret, useSandbox }) => {
  const endpoint = useSandbox ? APPLE_VERIFY_RECEIPT_SANDBOX : APPLE_VERIFY_RECEIPT_PROD;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': false,
    }),
  });

  const rawBody = await response.text();
  let body = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch (_) {
    body = null;
  }

  return {
    httpStatus: response.status,
    body,
    rawBody,
  };
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const stringValue = String(value || '').trim();
  if (!stringValue) return 0;

  if (/^\d+$/.test(stringValue)) {
    const parsedInt = Number.parseInt(stringValue, 10);
    return Number.isFinite(parsedInt) ? parsedInt : 0;
  }

  const parsedDate = Date.parse(stringValue);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
};

const isAutoRenewDisabled = (value) => {
  if (value === 0 || value === '0' || value === false) return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'false') return true;
  return false;
};

const resolveCancelAtPeriodEndFromVerifyReceipt = ({ verifyBody, originalTransactionId, status }) => {
  if (status !== 'active') return false;

  const pendingRenewalInfo = Array.isArray(verifyBody?.pending_renewal_info)
    ? verifyBody.pending_renewal_info
    : [];
  if (!pendingRenewalInfo.length) return false;

  const targetOriginalTxnId = String(originalTransactionId || '');
  const matchedEntry = targetOriginalTxnId
    ? pendingRenewalInfo.find(
      (item) => String(item?.original_transaction_id || '') === targetOriginalTxnId
    )
    : null;

  const candidate = matchedEntry || pendingRenewalInfo[0] || null;
  if (!candidate) return false;

  return isAutoRenewDisabled(candidate?.auto_renew_status);
};

const resolveCancelAtPeriodEndFromRenewalPayload = ({
  renewalPayload,
  notificationType,
  notificationSubtype,
  status,
}) => {
  if (status !== 'active') return false;

  const subtype = String(notificationSubtype || '').toUpperCase();
  if (subtype === 'AUTO_RENEW_DISABLED') return true;

  const autoRenewStatus =
    renewalPayload?.autoRenewStatus ?? renewalPayload?.auto_renew_status ?? null;

  if (isAutoRenewDisabled(autoRenewStatus)) return true;

  return notificationType === 'DID_CHANGE_RENEWAL_STATUS' && subtype !== 'AUTO_RENEW_ENABLED';
};

const resolveFromVerifyReceipt = ({
  verifyBody,
  validProductIds,
  configuredAnnualId,
  fallbackOriginalTransactionId,
  fallbackTransactionId,
}) => {
  const latest = Array.isArray(verifyBody?.latest_receipt_info)
    ? verifyBody.latest_receipt_info
    : [];
  const receiptInApp = Array.isArray(verifyBody?.receipt?.in_app)
    ? verifyBody.receipt.in_app
    : [];
  const allItems = [...latest, ...receiptInApp];

  const targetOriginalTxnId = String(
    fallbackOriginalTransactionId || fallbackTransactionId || ''
  );

  const normalized = allItems
    .map((item) => ({
      productId: item?.product_id || null,
      transactionId: item?.transaction_id || null,
      originalTransactionId: item?.original_transaction_id || null,
      expiresDateMs: toMillis(item?.expires_date_ms || item?.expires_date),
      purchaseDateMs: toMillis(item?.purchase_date_ms || item?.purchase_date),
    }))
    .filter((item) => item.productId && validProductIds.has(item.productId));

  if (!normalized.length) return null;

  const matchingTransactions = targetOriginalTxnId
    ? normalized.filter(
      (item) =>
        item.originalTransactionId === targetOriginalTxnId ||
        item.transactionId === targetOriginalTxnId
    )
    : [];

  const candidates = matchingTransactions.length ? matchingTransactions : normalized;
  candidates.sort((a, b) => {
    if (b.expiresDateMs !== a.expiresDateMs) return b.expiresDateMs - a.expiresDateMs;
    return b.purchaseDateMs - a.purchaseDateMs;
  });

  const chosen = candidates[0];
  if (!chosen) return null;

  const hasFutureExpiry =
    Number.isFinite(chosen.expiresDateMs) && chosen.expiresDateMs > Date.now();

  return {
    status: hasFutureExpiry ? 'active' : 'expired',
    plan: isAnnualProductId(chosen.productId, configuredAnnualId) ? 'annual' : 'monthly',
    renewalDateMs: chosen.expiresDateMs || null,
    productId: chosen.productId,
    transactionId: chosen.transactionId || fallbackTransactionId || null,
    originalTransactionId:
      chosen.originalTransactionId ||
      fallbackOriginalTransactionId ||
      fallbackTransactionId ||
      null,
    purchaseMs: chosen.purchaseDateMs || Date.now(),
    environment: verifyBody?.environment || null,
  };
};

const getFallbackRenewalDateMs = ({ plan, purchaseMs }) => {
  const baseDate = new Date(Number.isFinite(purchaseMs) ? purchaseMs : Date.now());

  if (plan === 'annual') {
    baseDate.setFullYear(baseDate.getFullYear() + 1);
  } else {
    baseDate.setMonth(baseDate.getMonth() + 1);
  }

  return baseDate.getTime();
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
      const {
        userId,
        productId,
        transactionId,
        originalTransactionId,
        purchaseDateMs,
        email,
        receiptData,
      } = data || {};

      if (userId && String(userId) !== String(uid)) {
        functions.logger.error('activateAppleSubscription uid mismatch', {
          authUid: uid,
          payloadUserId: String(userId),
          productId: productId || null,
          transactionId: transactionId || null,
        });

        throw new functions.https.HttpsError(
          'permission-denied',
          'Account mismatch detected during Apple subscription activation. Please sign out and back in.'
        );
      }

      if (!productId || !transactionId) {
        functions.logger.error('activateAppleSubscription missing identifiers', {
          uid, productId, transactionId, originalTransactionId,
        });
        throw new functions.https.HttpsError(
          'invalid-argument',
          'productId and transactionId are required.'
        );
      }

      const origTxnId = originalTransactionId || transactionId;
      const productIds = getAppleProductIds();
      const validProductIds = getAppleProductAliases(productIds);
      const sharedSecret = readEnv('APPLE_SHARED_SECRET') || readEnv('APPLE_APP_SHARED_SECRET');

      if (receiptData && sharedSecret) {
        let verifyResult = await verifyReceiptWithApple({
          receiptData,
          sharedSecret,
          useSandbox: false,
        });

        if (Number(verifyResult.body?.status) === 21007) {
          verifyResult = await verifyReceiptWithApple({
            receiptData,
            sharedSecret,
            useSandbox: true,
          });
        }

        const verifyStatus = Number(verifyResult.body?.status);
        functions.logger.info('Apple verifyReceipt outcome', {
          uid,
          verifyStatus: Number.isFinite(verifyStatus) ? verifyStatus : null,
          httpStatus: verifyResult.httpStatus,
          environment: verifyResult.body?.environment || null,
          hasLatestReceiptInfo: Array.isArray(verifyResult.body?.latest_receipt_info),
        });

        if (verifyStatus === 21004) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Apple shared secret mismatch (verifyReceipt status 21004).'
          );
        }

        if (verifyStatus !== 0) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Apple verifyReceipt returned status ${verifyStatus}.`
          );
        }

        const resolved = resolveFromVerifyReceipt({
          verifyBody: verifyResult.body,
          validProductIds,
          configuredAnnualId: productIds.annual,
          fallbackOriginalTransactionId: origTxnId,
          fallbackTransactionId: transactionId,
        });

        if (!resolved) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'No valid Apple subscription transaction found in verifyReceipt response.'
          );
        }

        const cancelAtPeriodEnd = resolveCancelAtPeriodEndFromVerifyReceipt({
          verifyBody: verifyResult.body,
          originalTransactionId: resolved.originalTransactionId,
          status: resolved.status,
        });

        await firestore
          .doc(`users/${uid}/subscription/current`)
          .set(
            {
              status: resolved.status,
              plan: resolved.plan,
              provider: 'apple_iap',
              appleProductId: resolved.productId,
              appleTransactionId: resolved.transactionId,
              appleOriginalTransactionId: resolved.originalTransactionId,
              purchaseDate: resolved.purchaseMs,
              renewalDate: resolved.renewalDateMs,
              appleReceiptEnvironment: resolved.environment,
              cancelAtPeriodEnd,
              email: email || null,
              updatedAt: FieldValue.serverTimestamp(),
              lastRenewal: resolved.status === 'active' ? FieldValue.serverTimestamp() : null,
            },
            { merge: true }
          );

        await syncSubscriptionRole(uid, resolved.status, {
          subscriptionStatus: resolved.status,
          subscriptionPlan: resolved.status === 'active' ? resolved.plan : null,
          subscriptionExpiresAt: resolved.status === 'active' ? resolved.renewalDateMs : null,
          subscriptionCancelAtPeriodEnd: resolved.status === 'active' ? cancelAtPeriodEnd : false,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          status: resolved.status,
          plan: resolved.plan,
          renewalDate: resolved.renewalDateMs,
          cancelAtPeriodEnd,
          environment: resolved.environment,
        };
      }

      const { keyId, issuerId, privateKey } = getAppStoreConfig();
      const jwt = await makeAppStoreJwt({ privateKey, keyId, issuerId });

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

      const groups = apiResult.body?.data || [];

      let matchedApiStatus = null;
      let matchedTxnPayload = null;
      let matchedRenewalPayload = null;
      outer: for (const group of groups) {
        for (const lastTxn of (group.lastTransactions || [])) {
          const txnPayload = decodeJwsPayload(lastTxn.signedTransactionInfo);
          if (txnPayload && validProductIds.has(txnPayload.productId)) {
            matchedApiStatus = lastTxn.status;
            matchedTxnPayload = txnPayload;
            matchedRenewalPayload = decodeJwsPayload(lastTxn.signedRenewalInfo);
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
      const purchaseMs = matchedTxnPayload.purchaseDate
        ? Number(matchedTxnPayload.purchaseDate)
        : (purchaseDateMs || Date.now());
      const plan = isAnnualProductId(matchedTxnPayload.productId, productIds.annual) ? 'annual' : 'monthly';

      const parsedRenewalMs = toMillis(
        matchedTxnPayload.expiresDate || matchedTxnPayload.expiresDateMs || null
      );
      const fallbackRenewalMs = getFallbackRenewalDateMs({ plan, purchaseMs });
      const renewalDateMs = parsedRenewalMs > 0 ? parsedRenewalMs : fallbackRenewalMs;
      const hasFutureExpiry = Number.isFinite(renewalDateMs) && renewalDateMs > Date.now();
      const isActiveByStatus =
        normalizedApiStatus === 1 || normalizedApiStatus === 3 || normalizedApiStatus === 4;
      const status = isActiveByStatus || hasFutureExpiry ? 'active' : 'expired';
      const cancelAtPeriodEnd = resolveCancelAtPeriodEndFromRenewalPayload({
        renewalPayload: matchedRenewalPayload,
        notificationType: null,
        notificationSubtype: null,
        status,
      });

      functions.logger.info('Apple subscription sync result', {
        uid,
        productId: matchedTxnPayload.productId,
        transactionId: matchedTxnPayload.transactionId || transactionId,
        originalTransactionId: matchedTxnPayload.originalTransactionId || origTxnId,
        apiStatusRaw: matchedApiStatus,
        apiStatusNormalized: Number.isFinite(normalizedApiStatus) ? normalizedApiStatus : null,
        renewalDateMs,
        usedFallbackRenewalDate: parsedRenewalMs <= 0,
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
            cancelAtPeriodEnd,
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
        subscriptionCancelAtPeriodEnd: status === 'active' ? cancelAtPeriodEnd : false,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        status,
        plan,
        renewalDate: renewalDateMs || null,
        cancelAtPeriodEnd,
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
      const cancelAtPeriodEnd = resolveCancelAtPeriodEndFromRenewalPayload({
        renewalPayload,
        notificationType,
        notificationSubtype: subtype,
        status,
      });

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
          cancelAtPeriodEnd,
          updatedAt: FieldValue.serverTimestamp(),
          lastRenewal: status === 'active' ? FieldValue.serverTimestamp() : null,
        },
        { merge: true }
      );

      await syncSubscriptionRole(uid, status, {
        subscriptionStatus: status,
        subscriptionPlan: status === 'active' ? plan : null,
        subscriptionExpiresAt: status === 'active' ? expiresDateMs || null : null,
        subscriptionCancelAtPeriodEnd: status === 'active' ? cancelAtPeriodEnd : false,
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

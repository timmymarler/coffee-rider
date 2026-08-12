import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'us-central1';
const RUNTIME_OPTS = {
  timeoutSeconds: 60,
  memory: '256MB',
};

const firestore = admin.firestore();
const { FieldValue } = admin.firestore;

const ALLOWED_TYPES = new Set(['search', 'route', 'photo', 'navigation', 'other']);
const SUBSCRIPTION_PROVIDERS = new Set(['stripe', 'apple_iap']);

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeType(rawType) {
  const value = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
  return ALLOWED_TYPES.has(value) ? value : 'other';
}

function normalizeEvent(rawEvent) {
  if (typeof rawEvent !== 'string') return 'unknown';
  const normalized = rawEvent.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return normalized.length > 0 ? normalized.slice(0, 64) : 'unknown';
}

async function getUserRole(uid) {
  const snap = await firestore.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const role = snap.data()?.role;
  return typeof role === 'string' ? role : null;
}

async function assertAdmin(uid) {
  const role = await getUserRole(uid);
  if (role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
}

function readTypeCount(row, type) {
  const nested = row?.counts?.[type];
  if (Number.isFinite(Number(nested))) {
    return Number(nested);
  }

  // Backward compatibility for documents that may have been written with
  // literal dotted keys (e.g. "counts.search") instead of nested maps.
  const dotted = row?.[`counts.${type}`];
  if (Number.isFinite(Number(dotted))) {
    return Number(dotted);
  }

  return 0;
}

function toMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value?.toDate && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isFinite(date?.getTime?.()) ? date.getTime() : 0;
  }

  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }

  return 0;
}

function getDocTimestampMs(docSnap, row, fieldNames = []) {
  for (const fieldName of fieldNames) {
    const candidate = row?.[fieldName];
    const ms = toMillis(candidate);
    if (ms > 0) return ms;
  }

  const metaCandidates = [docSnap?.createTime, docSnap?.updateTime, docSnap?.readTime];
  for (const candidate of metaCandidates) {
    const ms = toMillis(candidate);
    if (ms > 0) return ms;
  }

  return 0;
}

function inferSubscriptionProvider(row) {
  const provider = String(row?.provider || '').trim().toLowerCase();
  if (SUBSCRIPTION_PROVIDERS.has(provider)) {
    return provider;
  }

  if (row?.appleTransactionId || row?.appleOriginalTransactionId || row?.appleProductId) {
    return 'apple_iap';
  }

  if (row?.stripeSubscriptionId) {
    return 'stripe';
  }

  return null;
}

export const trackUsageEvent = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const type = normalizeType(data?.type);
    const event = normalizeEvent(data?.event);
    const dayKey = getTodayKey();

    const userRole = await getUserRole(uid);
    const roleKey = typeof userRole === 'string' ? userRole : 'unknown';

    const docRef = firestore.doc(`usageDaily/${dayKey}`);

    await docRef.set({
      dayKey,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const payload = {
      updatedAt: FieldValue.serverTimestamp(),
      totalCount: FieldValue.increment(1),
      [`counts.${type}`]: FieldValue.increment(1),
      [`events.${event}`]: FieldValue.increment(1),
      [`roles.${roleKey}`]: FieldValue.increment(1),
    };

    await docRef.update(payload);

    return { ok: true, dayKey, type, event };
  });

export const getDailyUsageStats = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    await assertAdmin(uid);

    const requestedDays = Number(data?.days);
    const days = Number.isFinite(requestedDays)
      ? Math.max(1, Math.min(60, Math.floor(requestedDays)))
      : 14;

    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const startKey = start.toISOString().slice(0, 10);
    const endKey = new Date().toISOString().slice(0, 10);
    const startMs = start.getTime();
    const endMs = new Date(`${endKey}T23:59:59.999Z`).getTime();

    const [snap, activeProSnap, registrationsSnap, subscriptionSnap] = await Promise.all([
      firestore
        .collection('usageDaily')
        .where('dayKey', '>=', startKey)
        .orderBy('dayKey', 'asc')
        .get(),
      firestore.collection('users').where('subscriptionStatus', 'in', ['active', 'trial']).get(),
      firestore
        .collection('users')
        .where('createdAt', '>=', start.toISOString())
        .where('createdAt', '<=', `${endKey}T23:59:59.999Z`)
        .get(),
      firestore.collectionGroup('subscription').get(),
    ]);

    const statsByDay = new Map();
    snap.docs.forEach((docSnap) => {
      const row = docSnap.data() || {};
      statsByDay.set(row.dayKey, {
        dayKey: row.dayKey,
        totalCount: Number(row.totalCount || 0),
        counts: {
          search: readTypeCount(row, 'search'),
          route: readTypeCount(row, 'route'),
          photo: readTypeCount(row, 'photo'),
          navigation: readTypeCount(row, 'navigation'),
          other: readTypeCount(row, 'other'),
        },
      });
    });

    let newAppleSubscriptions = 0;
    let newAndroidSubscriptions = 0;

    subscriptionSnap.docs.forEach((docSnap) => {
      const row = docSnap.data() || {};
      const provider = inferSubscriptionProvider(row);
      if (!provider) return;

      const status = String(row?.status || '').trim().toLowerCase();
      if (status && !['active', 'trial'].includes(status)) {
        return;
      }

      const startedAtMs = getDocTimestampMs(docSnap, row, [
        'subscriptionActivatedAt',
        'activatedAt',
        'createdAt',
        'purchaseDate',
        'trialStartedAt',
        'updatedAt',
      ]);

      if (startedAtMs < startMs || startedAtMs > endMs) {
        return;
      }

      if (provider === 'apple_iap') {
        newAppleSubscriptions += 1;
      } else if (provider === 'stripe') {
        newAndroidSubscriptions += 1;
      }
    });

    const daysList = [];
    const cursor = new Date(start);
    const today = new Date();

    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      daysList.push(
        statsByDay.get(key) || {
          dayKey: key,
          totalCount: 0,
          counts: {
            search: 0,
            route: 0,
            photo: 0,
            navigation: 0,
            other: 0,
          },
        }
      );
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      ok: true,
      days,
      summary: {
        activeProUsers: activeProSnap.docs.length,
        newRegistrations: registrationsSnap.docs.length,
        newAppleSubscriptions,
        newAndroidSubscriptions,
      },
      rows: daysList,
      generatedAt: new Date().toISOString(),
    };
  });

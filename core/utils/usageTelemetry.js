import { auth, functions } from '@config/firebase';
import { httpsCallable } from 'firebase/functions';

const trackUsageEventCallable = httpsCallable(functions, 'trackUsageEvent');
const getDailyUsageStatsCallable = httpsCallable(functions, 'getDailyUsageStats');

const lastSentByKey = new Map();

function shouldThrottle(key, cooldownMs) {
  if (!cooldownMs || cooldownMs <= 0) return false;
  const now = Date.now();
  const last = lastSentByKey.get(key) || 0;
  if (now - last < cooldownMs) {
    return true;
  }
  lastSentByKey.set(key, now);
  return false;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const output = {};
  const entries = Object.entries(meta).slice(0, 8);
  for (const [key, value] of entries) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    if (!safeKey) continue;

    const type = typeof value;
    if (type === 'string') {
      output[safeKey] = value.slice(0, 120);
    } else if (type === 'number' || type === 'boolean') {
      output[safeKey] = value;
    }
  }
  return output;
}

export async function trackUsageEvent(type, event, { cooldownMs = 0, meta = {} } = {}) {
  if (!auth.currentUser?.uid) {
    return { skipped: true, reason: 'unauthenticated' };
  }

  const normalizedType = String(type || 'other').toLowerCase();
  const normalizedEvent = String(event || 'unknown').toLowerCase();
  const throttleKey = `${normalizedType}:${normalizedEvent}`;

  if (shouldThrottle(throttleKey, cooldownMs)) {
    return { skipped: true, reason: 'throttled' };
  }

  const result = await trackUsageEventCallable({
    type: normalizedType,
    event: normalizedEvent,
    meta: sanitizeMeta(meta),
  });

  return result?.data || { ok: true };
}

export function trackUsageEventSafe(type, event, options = {}) {
  trackUsageEvent(type, event, options).catch((error) => {
    console.log('[usageTelemetry] trackUsageEvent failed:', error?.message || error);
  });
}

export async function getDailyUsageStats(days = 14) {
  const result = await getDailyUsageStatsCallable({ days });
  return result?.data || { ok: false, rows: [] };
}

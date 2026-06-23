#!/usr/bin/env node
/*
 * Normalizes missing `provider` field in users/{uid}/subscription/current.
 *
 * Default mode is DRY RUN (read-only).
 * Use --apply to write changes.
 *
 * Auth: uses Firebase CLI OAuth token from ~/.config/configstore/firebase-tools.json
 * Project: coffee-rider-bea88 (override with --project=<id>)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PROJECT = (args.find((a) => a.startsWith('--project=')) || '').split('=')[1] || 'coffee-rider-bea88';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function getTokenConfig() {
  const p = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j?.tokens?.refresh_token) {
    throw new Error('No firebase CLI refresh token found. Run: firebase login');
  }
  return {
    configPath: p,
    config: j,
  };
}

function request(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
          return;
        }
        reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function requestForm(method, url, formBody) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
          return;
        }
        reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
      });
    });

    req.on('error', reject);
    req.write(formBody);
    req.end();
  });
}

function parseBatch(raw) {
  const t = (raw || '').trim();
  if (!t) return [];
  if (t.startsWith('[')) return JSON.parse(t);
  return t.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => JSON.parse(s));
}

function decode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = decode(val);
    return out;
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  return null;
}

function decodeFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decode(v);
  return out;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function refreshAccessToken(tokenConfig) {
  const refreshToken = tokenConfig?.config?.tokens?.refresh_token;
  if (!refreshToken) throw new Error('Missing refresh token');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: FIREBASE_CLIENT_ID,
    client_secret: FIREBASE_CLIENT_SECRET,
  }).toString();

  const raw = await requestForm('POST', 'https://oauth2.googleapis.com/token', body);
  const json = JSON.parse(raw);
  if (!json?.access_token) {
    throw new Error(`Unable to refresh access token: ${raw.slice(0, 300)}`);
  }

  // Persist refreshed token for follow-up tooling reuse.
  tokenConfig.config.tokens.access_token = json.access_token;
  tokenConfig.config.tokens.expires_in = json.expires_in || null;
  tokenConfig.config.tokens.expires_at = json.expires_in
    ? Date.now() + Number(json.expires_in) * 1000
    : tokenConfig.config.tokens.expires_at;
  fs.writeFileSync(tokenConfig.configPath, JSON.stringify(tokenConfig.config, null, 2));

  return json.access_token;
}

function inferProvider(sub) {
  const hasStripe = Boolean(sub.stripeSubscriptionId);
  const hasApple = Boolean(sub.appleTransactionId) || Boolean(sub.appleOriginalTransactionId);

  if (hasStripe && !hasApple) return { provider: 'stripe', reason: 'has stripeSubscriptionId only' };
  if (hasApple && !hasStripe) return { provider: 'apple_iap', reason: 'has apple transaction fields only' };
  if (hasApple && hasStripe) return { provider: null, reason: 'ambiguous: has both stripe and apple fields' };
  return { provider: null, reason: 'unknown: no provider-identifying fields present' };
}

async function main() {
  const tokenConfig = getTokenConfig();
  const token = await refreshAccessToken(tokenConfig);
  const uids = [];

  let next = '';
  do {
    const url = `${BASE}/users?pageSize=300${next ? `&pageToken=${encodeURIComponent(next)}` : ''}`;
    const raw = await request('GET', url, token);
    const json = JSON.parse(raw);
    for (const doc of json.documents || []) {
      const uid = doc.name.split('/').pop();
      if (uid) uids.push(uid);
    }
    next = json.nextPageToken || '';
  } while (next);

  const subs = new Map();
  for (const ids of chunk(uids, 100)) {
    const docs = ids.map((uid) => `projects/${PROJECT}/databases/(default)/documents/users/${uid}/subscription/current`);
    const raw = await request('POST', `${BASE}:batchGet`, token, { documents: docs });
    for (const e of parseBatch(raw)) {
      if (!e.found) continue;
      const name = e.found.name;
      if (!name.endsWith('/subscription/current')) continue;
      const uidMatch = name.match(/\/documents\/users\/([^/]+)\/subscription\/current$/);
      if (!uidMatch) continue;
      subs.set(uidMatch[1], decodeFields(e.found.fields || {}));
    }
  }

  const rows = [];
  for (const [uid, sub] of subs.entries()) {
    rows.push({ uid, sub });
  }

  const missingProvider = rows.filter(({ sub }) => !sub.provider);
  const toPatch = [];
  const skipped = [];

  for (const row of missingProvider) {
    const inferred = inferProvider(row.sub);
    if (inferred.provider) {
      toPatch.push({ uid: row.uid, provider: inferred.provider, reason: inferred.reason });
    } else {
      skipped.push({ uid: row.uid, reason: inferred.reason });
    }
  }

  console.log('MODE', APPLY ? 'APPLY' : 'DRY_RUN');
  console.log('PROJECT', PROJECT);
  console.log('TOTAL_SUBSCRIPTION_DOCS', rows.length);
  console.log('MISSING_PROVIDER', missingProvider.length);
  console.log('PATCHABLE', toPatch.length);
  console.log('SKIPPED', skipped.length);
  console.log('PATCH_SAMPLE', JSON.stringify(toPatch.slice(0, 20), null, 2));
  console.log('SKIPPED_SAMPLE', JSON.stringify(skipped.slice(0, 20), null, 2));

  if (!APPLY) {
    console.log('DRY_RUN_COMPLETE');
    return;
  }

  let applied = 0;
  for (const item of toPatch) {
    const docPath = `${BASE}/users/${item.uid}/subscription/current?updateMask.fieldPaths=provider`;
    const body = {
      fields: {
        provider: { stringValue: item.provider },
      },
    };
    await request('PATCH', docPath, token, body);
    applied += 1;
  }

  console.log('APPLIED_PATCHES', applied);
}

main().catch((err) => {
  console.error('NORMALIZATION_ERROR', err && (err.stack || err.message || err));
  process.exit(1);
});

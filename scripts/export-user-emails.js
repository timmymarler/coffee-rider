#!/usr/bin/env node
/*
 * Exports user emails from Firestore users collection to CSV.
 *
 * Auth: Firebase CLI OAuth token from ~/.config/configstore/firebase-tools.json
 * Default project: coffee-rider-bea88 (override with --project=<id>)
 *
 * Usage:
 *   node scripts/export-user-emails.js
 *   node scripts/export-user-emails.js --project=<id> --out=exports/user-emails.csv
 *   node scripts/export-user-emails.js --include-relay
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const PROJECT = (args.find((a) => a.startsWith('--project=')) || '').split('=')[1] || 'coffee-rider-bea88';
const OUT_ARG = (args.find((a) => a.startsWith('--out=')) || '').split('=')[1] || null;
const INCLUDE_RELAY = args.includes('--include-relay');

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function getTokenConfig() {
  const p = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j?.tokens?.refresh_token) {
    throw new Error('No firebase CLI refresh token found. Run: firebase login');
  }
  return { configPath: p, config: j };
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

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isAppleRelay(email) {
  return email.endsWith('@privaterelay.appleid.com');
}

function csvEscape(value) {
  const raw = value == null ? '' : String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function toCsv(rows) {
  const headers = ['uid', 'email', 'contactEmail', 'role', 'createdAt'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
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

  tokenConfig.config.tokens.access_token = json.access_token;
  tokenConfig.config.tokens.expires_in = json.expires_in || null;
  tokenConfig.config.tokens.expires_at = json.expires_in
    ? Date.now() + Number(json.expires_in) * 1000
    : tokenConfig.config.tokens.expires_at;

  fs.writeFileSync(tokenConfig.configPath, JSON.stringify(tokenConfig.config, null, 2));

  return json.access_token;
}

async function main() {
  const tokenConfig = getTokenConfig();
  const token = await refreshAccessToken(tokenConfig);

  const users = [];
  let next = '';

  do {
    const url = `${BASE}/users?pageSize=300${next ? `&pageToken=${encodeURIComponent(next)}` : ''}`;
    const raw = await request('GET', url, token);
    const json = JSON.parse(raw);

    for (const doc of json.documents || []) {
      const uid = doc.name.split('/').pop();
      const fields = decodeFields(doc.fields || {});
      const email = normalizeEmail(fields.email);
      const contactEmail = normalizeEmail(fields.contactEmail);
      const chosenEmail = contactEmail || email;

      if (!chosenEmail) continue;
      if (!INCLUDE_RELAY && isAppleRelay(chosenEmail)) continue;

      users.push({
        uid,
        email,
        contactEmail,
        role: fields.role || '',
        createdAt: fields.createdAt || '',
      });
    }

    next = json.nextPageToken || '';
  } while (next);

  const dedupedMap = new Map();
  for (const row of users) {
    const key = (row.contactEmail || row.email || '').toLowerCase();
    if (!key) continue;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, row);
    }
  }

  const deduped = Array.from(dedupedMap.values()).sort((a, b) => {
    const ea = (a.contactEmail || a.email || '');
    const eb = (b.contactEmail || b.email || '');
    return ea.localeCompare(eb);
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const outPath = OUT_ARG
    ? path.resolve(process.cwd(), OUT_ARG)
    : path.resolve(process.cwd(), 'exports', `user-emails-${dateStamp}.csv`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, toCsv(deduped), 'utf8');

  console.log('PROJECT', PROJECT);
  console.log('TOTAL_USERS_WITH_EMAIL', users.length);
  console.log('TOTAL_UNIQUE_EMAILS', deduped.length);
  console.log('INCLUDE_APPLE_RELAY', INCLUDE_RELAY ? 'yes' : 'no');
  console.log('CSV_PATH', outPath);
}

main().catch((err) => {
  console.error('EXPORT_FAILED', err && (err.stack || err.message || err));
  process.exit(1);
});

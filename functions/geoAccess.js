import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'us-central1';
const RUNTIME_OPTS = {
  timeoutSeconds: 30,
  memory: '256MB',
};

const BLOCKED_BOUNDS = [
  { minLat: 18, maxLat: 55, minLng: 70, maxLng: 150 },
];

function isInBlockedRegion(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return BLOCKED_BOUNDS.some((bounds) => (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  ));
}

function getClientIp(rawRequest) {
  if (!rawRequest) return null;

  const forwardedFor = rawRequest.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = rawRequest.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return rawRequest.ip || null;
}

export const checkGooglePlacesAccess = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    const latitude = Number(data?.latitude);
    const longitude = Number(data?.longitude);

    const isBlocked = isInBlockedRegion(latitude, longitude);

    return {
      allowed: !isBlocked,
      blocked: isBlocked,
      region: isBlocked ? 'east_asia' : 'allowed',
      clientIp: getClientIp(context.rawRequest) || null,
      latitude,
      longitude,
    };
  });

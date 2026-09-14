import { functions } from "@config/firebase";
import { GOOGLE_PLACES_BLOCKED_REGION_BOUNDS } from "@core/config/launchFlags";
import { httpsCallable } from "firebase/functions";

const checkGooglePlacesAccessCallable = httpsCallable(functions, "checkGooglePlacesAccess");

export function isInBlockedGoogleRegion(latitude, longitude) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return false;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  return GOOGLE_PLACES_BLOCKED_REGION_BOUNDS.some((bounds) => (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  ));
}

export async function canUseGooglePlacesAccess({ latitude, longitude, context = "google_places" } = {}) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    console.log(`[GOOGLE] Missing or invalid coordinates for ${context}; skipping Google call.`);
    return false;
  }

  if (isInBlockedGoogleRegion(latitude, longitude)) {
    console.log(`[GOOGLE] Local blocked region for ${context}; skipping Google call.`);
    return false;
  }

  const geoCheck = await checkGooglePlacesAccessCallable({ latitude, longitude }).catch((error) => {
    console.warn(`[GOOGLE] Geo access check failed for ${context}; failing closed.`, error?.message || error);
    return { data: { allowed: false, blocked: true } };
  });

  if (geoCheck?.data?.blocked || geoCheck?.data?.allowed === false) {
    console.log(`[GOOGLE] Server blocked region for ${context}; skipping Google call.`);
    return false;
  }

  return true;
}

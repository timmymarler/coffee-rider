export const IOS_SUBSCRIPTIONS_TEMP_DISABLED = false;

export const IOS_SUBSCRIPTIONS_DISABLED_MESSAGE =
  "Soft launch: subscriptions are currently unavailable on iOS. You currently have full map access with limited route planning on the Free plan.";

// Cost-control toggles for Google Places usage.
// Keep this true while monitoring billing spikes.
export const GOOGLE_PLACES_COST_SAVER_MODE = true;

// Manual Google Places text search is allowed only for Pro/Admin users.
// Auto nearby fetch remains disabled to prevent runaway billing from map movement.
export const GOOGLE_PLACES_LIVE_SEARCH_ENABLED = true;

// Block Google Places requests when the user is in a region with excessive API spend.
// This is a coarse client-side safety net; the real enforcement should happen in a server-side geo gate.
export const GOOGLE_PLACES_BLOCKED_REGION_BOUNDS = [
  { minLat: 18, maxLat: 55, minLng: 70, maxLng: 150 },
];

// Photos are disabled by default until a place has been cached locally and normalized.
export const GOOGLE_PLACE_PHOTOS_ENABLED = false;

// Cap manual Google text-search usage so Pro/Admin can still search without creating runaway spend.
export const GOOGLE_TEXT_SEARCH_DAILY_LIMIT = 50;
export const GOOGLE_TEXT_SEARCH_DAILY_LIMIT_ENABLED = true;

// Cache identical text searches for a short window to avoid duplicate billable requests.
export const GOOGLE_TEXT_SEARCH_CACHE_TTL_MS = GOOGLE_PLACES_COST_SAVER_MODE ? 5 * 60 * 1000 : 60 * 1000;

// Restricted free access window after account creation.
// Outside this one-time window, non-subscribed users fall back to guest-level capabilities.
export const RESTRICTED_FREE_ACCESS_WINDOW_ENABLED = true;
export const RESTRICTED_FREE_ACCESS_WINDOW_DAYS = 7;

export const IOS_SUBSCRIPTIONS_TEMP_DISABLED = false;

export const IOS_SUBSCRIPTIONS_DISABLED_MESSAGE =
  "Soft launch: subscriptions are currently unavailable on iOS. You currently have full map access with limited route planning on the Free plan.";

// Cost-control toggles for Google Places usage.
// Keep this true while monitoring billing spikes.
export const GOOGLE_PLACES_COST_SAVER_MODE = true;

// In cost-saver mode we skip Google Place Photo API calls, which are a common cost driver.
export const GOOGLE_PLACE_PHOTOS_ENABLED = !GOOGLE_PLACES_COST_SAVER_MODE;

// Cache identical text searches for a short window to avoid duplicate billable requests.
export const GOOGLE_TEXT_SEARCH_CACHE_TTL_MS = GOOGLE_PLACES_COST_SAVER_MODE ? 5 * 60 * 1000 : 60 * 1000;

// Restricted free access window after account creation.
// Outside this one-time window, non-subscribed users fall back to guest-level capabilities.
export const RESTRICTED_FREE_ACCESS_WINDOW_ENABLED = true;
export const RESTRICTED_FREE_ACCESS_WINDOW_DAYS = 7;

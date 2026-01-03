const cache = new Map();

export function getCachedGooglePhoto(placeId) {
  return cache.get(placeId);
}

export function setCachedGooglePhoto(placeId, uri) {
  cache.set(placeId, uri);
}

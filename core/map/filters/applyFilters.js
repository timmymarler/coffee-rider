export function applyFilters(poi, filters) {
  // Check category filter for both CR and Google POIs
  if (filters.categories.size && !filters.categories.has(poi.category)) {
    return false;
  }

  // Skip amenities filter for Google POIs, only check for CR places
  if (poi.source === "cr" && filters.amenities.size) {
    for (const a of filters.amenities) {
      if (!poi.amenities?.[a]) return false;
    }
  }

  return true;
}

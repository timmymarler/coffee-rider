export function applyFilters(poi, filters) {

  // Hide unclassified Google POIs (noise reduction)
  if (poi.source === "google" && poi.category === "unknown") {
    return false;
  }

  // Category filter (CR + Google)
  if (filters.categories.size > 0) {
    if (!filters.categories.has(poi.category)) {
      return false;
    }
  }

  // Suitability filter (CR Only)
  if (poi.source === "cr" && filters.suitability.size > 0) {
    if (!Array.isArray(poi.suitability)) return false;

    // Use OR logic: place must match at least one selected suitability
    const hasAnySuitability = Array.from(filters.suitability).some(suitability =>
      poi.suitability.includes(suitability)
    );
    
    if (!hasAnySuitability) {
      return false;
    }
  }

  // Amenities filter (CR only)
  if (poi.source === "cr" && filters.amenities.size > 0) {
    if (!Array.isArray(poi.amenities)) return false;

    for (const amenity of filters.amenities) {
      if (!poi.amenities.includes(amenity)) {
        return false;
      }
    }
  }

  return true;
}

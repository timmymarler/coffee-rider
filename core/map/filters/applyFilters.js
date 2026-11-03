import { getOpeningStatus } from "@/core/map/utils/openingHours";

export function applyFilters(poi, filters, options = {}) {
  const { allowUnknownGoogle = false } = options;
  const matchMode = filters.matchMode === "any" ? "any" : "all";

  // Hide unclassified Google POIs (noise reduction)
  if (!allowUnknownGoogle && poi.source === "google" && poi.category === "unknown") {
    return false;
  }

  const activeChecks = [];

  // Category filter (CR + Google)
  if (filters.categories.size > 0) {
    activeChecks.push(filters.categories.has(poi.category));
  }

  // Suitability filter (CR Only)
  if (poi.source === "cr" && filters.suitability.size > 0) {
    if (!Array.isArray(poi.suitability)) {
      activeChecks.push(false);
    } else {
      // Place must match at least one selected suitability
      const hasAnySuitability = Array.from(filters.suitability).some((suitability) =>
        poi.suitability.includes(suitability)
      );

      activeChecks.push(hasAnySuitability);
    }
  }

  // Amenities filter (CR only)
  if (poi.source === "cr" && filters.amenities.size > 0) {
    if (!Array.isArray(poi.amenities)) {
      activeChecks.push(false);
    } else {
      let hasAllAmenities = true;
      for (const amenity of filters.amenities) {
        if (!poi.amenities.includes(amenity)) {
          hasAllAmenities = false;
          break;
        }
      }

      activeChecks.push(hasAllAmenities);
    }
  }

  // Bike & Brew filter (CR only); PlaceCard edits store it in suitability, creation sets the top-level flag
  if (poi.source === "cr" && filters.bikeBrew) {
    activeChecks.push(
      Boolean(poi.bikeBrew) ||
      (Array.isArray(poi.suitability) && poi.suitability.includes("bikeBrew")) ||
      poi.suitability?.bikeBrew === true
    );
  }

  // chat'able filter (CR only); same storage forms as Bike & Brew
  if (poi.source === "cr" && filters.chatable) {
    activeChecks.push(
      Boolean(poi.chatable) ||
      (Array.isArray(poi.suitability) && poi.suitability.includes("chatable")) ||
      poi.suitability?.chatable === true
    );
  }

  // Open now filter (CR + Google)
  if (filters.openNow) {
    const openingHours = poi.regularOpeningHours || poi.opening_hours || null;
    const status = getOpeningStatus(openingHours);
    activeChecks.push(Boolean(status?.isOpen));
  }

  if (activeChecks.length === 0) {
    return true;
  }

  return matchMode === "any" ? activeChecks.some(Boolean) : activeChecks.every(Boolean);
}

// ------------------------------------------------------------
// applyFilters(poi, filters, theme, FILTER_GROUPS)
// The single source of truth for whether a POI displays on map.
// ------------------------------------------------------------

export function applyFilters(poi, filters, theme, FILTER_GROUPS) {
  if (!poi) return false;

  const {
    query = "",
    groups = new Set(),        // Selected filter groups: "cafe", "food", "fuel", etc.
    suitability = new Set(),   // Rider-specific CR suitability filters
    amenities = new Set(),     // Amenity filters
  } = filters || {};

  const text = query.trim().toLowerCase();

  // ------------------------------------------------------------
  // 1. TEXT SEARCH (CR + Google)
  // ------------------------------------------------------------
  if (text) {
    const haystack = [
      poi.title?.toLowerCase() ?? "",
      poi.address?.toLowerCase() ?? "",
      poi.keywords?.join(" ").toLowerCase() ?? "",
    ].join(" ");

    if (!haystack.includes(text)) {
      return false;
    }
  }

  // ------------------------------------------------------------
  // 2. FILTER GROUP SELECTION (primary control for Google)
  // ------------------------------------------------------------
  if (groups.size > 0) {
    // If the POI’s category does NOT match any chosen groups → hide it
    if (!groups.has(poi.category)) {
      return false;
    }
  }

  // ------------------------------------------------------------
  // 3. CR SUITABILITY FILTERING
  // ------------------------------------------------------------
  if (poi.source === "cr") {
    // If user selected explicit suitability filters, enforce them:
    if (suitability.size > 0) {
      let match = false;
      suitability.forEach((key) => {
        if (poi.suitability?.[key] === true) match = true;
      });
      if (!match) return false;
    }

    // If Rider theme is active → hide CR places with no rider-relevant suitability
    if (theme === "rider" && suitability.size === 0) {
      const isBikeRelevant =
        poi.suitability?.bikers ||
        poi.suitability?.scooters ||
        poi.suitability?.mopeds;

      if (!isBikeRelevant) {
        return false;
      }
    }
  }

  // ------------------------------------------------------------
  // 4. AMENITIES FILTER (CR only, Google passes)
  // ------------------------------------------------------------
  if (amenities.size > 0 && poi.source === "cr") {
    for (const a of amenities) {
      if (poi.amenities?.[a] !== true) return false;
    }
  }

  // ------------------------------------------------------------
  // 5. THEME-BASED DEFAULT FILTERING
  // If no filter groups selected → use theme defaults.
  // ------------------------------------------------------------
  if (groups.size === 0) {
    if (theme === "rider") {
      const riderRelevant = new Set([
        "cafe",
        "food",
        "fuel",
        "motorcycle",
        "parking",
        "scenic",
        "shop",
      ]);

      // CR places already passed suitability above → show them.
      if (poi.source !== "cr" && !riderRelevant.has(poi.category)) {
        return false;
      }
    }

    // (Driver & Strider defaults will be added later)
  }

  // ------------------------------------------------------------
  // PASSED ALL FILTERS → DISPLAY
  // ------------------------------------------------------------
  return true;
}

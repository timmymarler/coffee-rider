import { THEME_CONFIG } from "../config/themeConfig";

export function passesFilters(place, appName, uiFilters) {
  const theme = THEME_CONFIG[appName];
  const title = (place.title || "").toLowerCase();

  // 1. Category filters (disabled until UI exists)
  if (uiFilters.categories.length > 0) {
    const matchesCategory = uiFilters.categories.some(catKey => {
      const group = theme.categories[catKey];
      if (!group) return false;

      const typeMatch = place.types?.some(t => group.types.includes(t));
      const keywordMatch = group.keywords.some(kw => title.includes(kw));
      return typeMatch || keywordMatch;
    });

    if (!matchesCategory) return false;
  }

  // 2. Suitability – applies ONLY to CR
  if (place.source === "cr") {
    if (uiFilters.suitability.length > 0) {
      const matches = uiFilters.suitability.some(key => place.suitability?.[key]);
      if (!matches) return false;
    } else {
      // Default Rider suitability
      const matches = theme.defaultSuitability.some(key => place.suitability?.[key]);
      if (!matches) return false;
    }
  }

  // 3. Amenities (later)
  if (uiFilters.amenities.length > 0) {
    const hasAmenities = uiFilters.amenities.every(key => place.amenities?.[key]);
    if (!hasAmenities) return false;
  }

  return true;
}

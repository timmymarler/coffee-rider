import { POI_FILTERS } from "./poiFilterConfig";

export function filterPois(pois, appName, userFilters = {}) {
  const config = POI_FILTERS[appName] || POI_FILTERS.rider;

  const allowedTypes = config.allowedTypes || [];
  const themeKeywords = config.keywords || [];
  const userTypes = userFilters.types || [];

  return pois.filter((p) => {
    let pass = true;

    // THEME: Keyword relevance
    if (themeKeywords.length > 0) {
      const title = p.title?.toLowerCase() || "";
      const matchesKeyword = themeKeywords.some((kw) =>
        title.includes(kw)
      );
      pass = pass && matchesKeyword;
    }

    // THEME: Type relevance
    if (allowedTypes.length > 0 && p.types) {
      const matchesType = p.types.some((t) =>
        allowedTypes.includes(t)
      );
      pass = pass && matchesType;
    }

    // USER FILTERS: manual selection (future UI)
    if (userTypes.length > 0) {
      const matchesUserType = userTypes.some((t) =>
        (p.types || []).includes(t)
      );
      pass = pass && matchesUserType;
    }

    return pass;
  });
}

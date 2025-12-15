// ------------------------------------------------------------
// classifyPoi(poi, FILTER_GROUPS)
// Produces a category that matches the filter groups exactly.
// ------------------------------------------------------------

const safeTypes = (group) =>
  Array.isArray(group?.googleTypes) ? group.googleTypes : [];

const safeKeywords = (group) =>
  Array.isArray(group?.keywords) ? group.keywords : [];

export function classifyPoi(poi, FILTER_GROUPS) {
  if (!FILTER_GROUPS || !FILTER_GROUPS.cafe) {
    console.warn(
      "classifyPoi called without valid FILTER_GROUPS",
      FILTER_GROUPS
    );
    return "other";
  }

  console.log("🔍 classifyPoi input", Object.keys(poi));

  const name = (poi.title || poi.name || "").toLowerCase();

  const googleTypes = Array.isArray(poi.googleTypes) ? poi.googleTypes : [];
  const allTypes = [...googleTypes];
  const keywords = Array.isArray(poi.keywords) ? poi.keywords : [];

  // ------------------------------------------------------------
  // 1. CAFÉ
  // ------------------------------------------------------------
  if (
    allTypes.some(t => safeTypes(FILTER_GROUPS.cafe).includes(t)) ||
    keywords.some(k => safeKeywords(FILTER_GROUPS.cafe).includes(k)) ||
    name.includes("cafe") ||
    name.includes("coffee") ||
    name.includes("espresso")
  ) {
    return "cafe";
  }

  // ------------------------------------------------------------
  // 2. FOOD
  // ------------------------------------------------------------
  if (
    allTypes.some(t => safeTypes(FILTER_GROUPS.food).includes(t)) ||
    keywords.some(k => safeKeywords(FILTER_GROUPS.food).includes(k)) ||
    name.includes("pub") ||
    name.includes("grill") ||
    name.includes("kitchen") ||
    name.includes("restaurant")
  ) {
    return "food";
  }

  // ------------------------------------------------------------
  // 3. FUEL
  // ------------------------------------------------------------
  if (
    allTypes.some(t => safeTypes(FILTER_GROUPS.fuel).includes(t)) ||
    keywords.some(k => safeKeywords(FILTER_GROUPS.fuel).includes(k))
  ) {
    return "fuel";
  }

  // ------------------------------------------------------------
  // 4. MOTORCYCLE
  // ------------------------------------------------------------
  if (
    allTypes.some(t => safeTypes(FILTER_GROUPS.motorcycle).includes(t)) ||
    keywords.some(k => safeKeywords(FILTER_GROUPS.motorcycle).includes(k)) ||
    name.includes("moto") ||
    name.includes("motorcycle") ||
    name.includes("bike shop")
  ) {
    return "motorcycle";
  }

  // ------------------------------------------------------------
  // 5. PARKING
  // ------------------------------------------------------------
  if (allTypes.some(t => safeTypes(FILTER_GROUPS.parking).includes(t))) {
    return "parking";
  }

  // ------------------------------------------------------------
  // 6. SCENIC
  // ------------------------------------------------------------
  if (
    allTypes.some(t => safeTypes(FILTER_GROUPS.scenic).includes(t)) ||
    keywords.some(k => safeKeywords(FILTER_GROUPS.scenic).includes(k)) ||
    name.includes("lookout") ||
    name.includes("view") ||
    name.includes("park") ||
    name.includes("nature")
  ) {
    return "scenic";
  }

  // ------------------------------------------------------------
  // 7. Motorbike stuff
  // ------------------------------------------------------------
  if (
    allTypes.includes("motorcycle_store") ||
    allTypes.includes("motorcycle_services")
  ) {
    return "shop";
  }

  // ------------------------------------------------------------
  // DEFAULT
  // ------------------------------------------------------------
  return "other";
}

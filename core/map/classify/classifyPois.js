// ------------------------------------------------------------
// classifyPoi(poi, FILTER_GROUPS)
// Produces a category that matches the filter groups exactly.
// ------------------------------------------------------------

export function classifyPoi(poi, FILTER_GROUPS) {
  const name = (poi.title || poi.name || "").toLowerCase();
  const googleTypes = poi.types || [];
  const keywords = poi.keywords || [];

  // ------------------------------------------------------------
  // 1. CATEGORY: CAFÉ
  // ------------------------------------------------------------
  if (
    googleTypes.some(t =>
      FILTER_GROUPS.cafe.googleTypes.includes(t)
    ) ||
    keywords.some(k =>
      FILTER_GROUPS.cafe.keywords.includes(k)
    ) ||
    name.includes("cafe") ||
    name.includes("coffee") ||
    name.includes("espresso")
  ) {
    return "cafe";
  }

  // ------------------------------------------------------------
  // 2. CATEGORY: FOOD (restaurants, pubs, takeaways)
  // ------------------------------------------------------------
  if (
    googleTypes.some(t =>
      FILTER_GROUPS.food.googleTypes.includes(t)
    ) ||
    keywords.some(k =>
      FILTER_GROUPS.food.keywords.includes(k)
    ) ||
    name.includes("pub") ||
    name.includes("grill") ||
    name.includes("kitchen") ||
    name.includes("restaurant")
  ) {
    return "food";
  }

  // ------------------------------------------------------------
  // 3. CATEGORY: FUEL
  // ------------------------------------------------------------
  if (
    googleTypes.some(t =>
      FILTER_GROUPS.fuel.googleTypes.includes(t)
    ) ||
    keywords.some(k =>
      FILTER_GROUPS.fuel.keywords.includes(k)
    )
  ) {
    return "fuel";
  }

  // ------------------------------------------------------------
  // 4. CATEGORY: MOTORCYCLE
  // ------------------------------------------------------------
  if (
    googleTypes.some(t =>
      FILTER_GROUPS.motorcycle.googleTypes.includes(t)
    ) ||
    keywords.some(k =>
      FILTER_GROUPS.motorcycle.keywords.includes(k)
    ) ||
    name.includes("moto") ||
    name.includes("motorcycle") ||
    name.includes("bike shop")
  ) {
    return "motorcycle";
  }

  // ------------------------------------------------------------
  // 5. CATEGORY: PARKING
  // ------------------------------------------------------------
  if (
    googleTypes.some(t =>
      FILTER_GROUPS.parking.googleTypes.includes(t)
    )
  ) {
    return "parking";
  }

  // ------------------------------------------------------------
  // 6. CATEGORY: SCENIC
  // ------------------------------------------------------------
  if (
    googleTypes.some(t =>
      FILTER_GROUPS.scenic.googleTypes.includes(t)
    ) ||
    keywords.some(k =>
      FILTER_GROUPS.scenic.keywords.includes(k)
    ) ||
    name.includes("lookout") ||
    name.includes("view") ||
    name.includes("park") ||
    name.includes("nature")
  ) {
    return "scenic";
  }

  // ------------------------------------------------------------
  // 7. CATEGORY: SHOP
  // ------------------------------------------------------------
  if (
    googleTypes.includes("store") ||
    googleTypes.includes("shopping_mall") ||
    googleTypes.includes("retail")
  ) {
    return "shop";
  }

  // ------------------------------------------------------------
  // DEFAULT
  // ------------------------------------------------------------
  return "other";
}

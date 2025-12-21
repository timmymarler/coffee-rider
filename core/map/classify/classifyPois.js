// classifyPois.js
// Conservative, type-first Google POI classification
// Bikes & scooters are INTENT-based and handled upstream

export function classifyPoi({ types = [], name = "" }) {
  if (!Array.isArray(types)) types = [];

  const t = new Set(types.map((x) => x.toLowerCase()));

  /* -------------------------------------------------- */
  /* FUEL (including service stations with food)       */
  /* -------------------------------------------------- */
  if (
    t.has("gas_station")
  ) {
    return "fuel";
  }

  /* -------------------------------------------------- */
  /* CAFÉ                                               */
  /* -------------------------------------------------- */
  if (
    t.has("cafe") ||
    t.has("coffee_shop")
  ) {
    return "cafe";
  }

  /* -------------------------------------------------- */
  /* PUB / BAR                                          */
  /* -------------------------------------------------- */
  if (
    t.has("bar") ||
    t.has("pub")
  ) {
    return "pub";
  }

  /* -------------------------------------------------- */
  /* RESTAURANT                                        */
  /* -------------------------------------------------- */
  if (
    t.has("restaurant") ||
    t.has("food")
  ) {
    return "restaurant";
  }

  /* -------------------------------------------------- */
  /* PARKING                                           */
  /* -------------------------------------------------- */
  if (t.has("parking")) {
    return "parking";
  }

  /* -------------------------------------------------- */
  /* SCENIC / VIEWPOINT                                */
  /* -------------------------------------------------- */
  if (
    t.has("tourist_attraction") ||
    t.has("park") ||
    t.has("natural_feature")
  ) {
    return "scenic";
  }

  /* -------------------------------------------------- */
  /* EVERYTHING ELSE                                   */
  /* -------------------------------------------------- */
  return "unknown";
}

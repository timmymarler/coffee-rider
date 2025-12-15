// core/map/classifyPoi.js

export function classifyPoi(place = {}) {
    if (!place || !Array.isArray(place.types)) {
    console.warn("classifyPoi called with invalid place", place);
    return "other";
  }

  const types = Array.isArray(place.types) ? place.types : [];
  const name = typeof place.name === "string" ? place.name : "";

  // PUBS (must come early)
  if (types.some(t =>
    ["pub", "bar", "lodging"].includes(t)
  )) {
    return "pub";
  }

  // CAFÉS
  if (types.includes("cafe")) {
    return "cafe";
  }

  // FOOD (restaurants that aren't pubs)
  if (types.includes("restaurant") || types.includes("food")) {
    return "food";
  }

  // FUEL
  if (types.includes("gas_station")) {
    return "fuel";
  }

  // PARKING
  if (types.includes("parking")) {
    return "parking";
  }

  // BIKES
  if (types.includes("auto_parts_store")) {
    return "bikes";
  }

  // SCENIC / POI
  if (types.includes("tourist_attraction")) {
    return "scenic";
  }

  const lowerName = name?.toLowerCase?.() || "";
  if (
    lowerName.includes("motorcycle") ||
    lowerName.includes("motorcycles") ||
    lowerName.includes("motorbike") ||
    lowerName.includes("motorbikes")
  ) {
    return "bikes";
  }

  return "other";
}

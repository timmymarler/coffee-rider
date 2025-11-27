// lib/geocode.js
// Helper to turn lat/lng into a nice place label.
// Tries a nearby Place (POI/business) first, then falls back to town/locality.

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const GEO_CACHE = {};

// Main API
export async function getPlaceLabel(lat, lng) {
  if (!GOOGLE_KEY) {
    console.warn("Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for geocoding.");
    return null;
  }

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (GEO_CACHE[cacheKey]) {
    return GEO_CACHE[cacheKey];
  }

  try {
    // 1) Try to get a nearby POI (e.g. "Two Flags Café")
    const nearbyUrl =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=50` +
      `&key=${GOOGLE_KEY}`;

    let label = null;

    const nearbyRes = await fetch(nearbyUrl);
    const nearbyJson = await nearbyRes.json();

    if (nearbyJson?.results?.length > 0) {
      const first = nearbyJson.results[0];
      if (first?.name) {
        label = first.name; // e.g. "Two Flags Café"
      }
    }

    // 2) If no POI name found, fall back to Geocoding (town / locality)
    if (!label) {
      const geoUrl =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${lat},${lng}` +
        `&key=${GOOGLE_KEY}`;

      const geoRes = await fetch(geoUrl);
      const geoJson = await geoRes.json();

      if (geoJson?.results?.length > 0) {
        const comps = geoJson.results[0].address_components || [];

        const getComp = (type) =>
          comps.find((c) => c.types.includes(type))?.long_name || null;

        const town =
          getComp("locality") ||
          getComp("postal_town") ||
          getComp("administrative_area_level_2") ||
          null;

        label = town;
      }
    }

    GEO_CACHE[cacheKey] = label;
    return label;
  } catch (err) {
    console.error("Error in getPlaceLabel:", err);
    return null;
  }
}

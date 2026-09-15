// lib/geocode.js
// Helper to turn lat/lng into a location label.
// Uses Geocoding only (no Places NearbySearch) to avoid Places API spend.

import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
const GOOGLE_KEY = Constants.expoConfig.extra.googleMapsApiKey;

const GEO_CACHE = {};
const GEO_PLACE_LABEL_CACHE_PREFIX = "@cr_geo_place_label_v1";
const GEO_ADDRESS_CACHE_PREFIX = "@cr_geo_address_v1";
const PLACE_LABEL_TTL_MS = 24 * 60 * 60 * 1000;
const ADDRESS_TTL_MS = 24 * 60 * 60 * 1000;

async function readPersistedGeoCache(prefix, key, ttlMs) {
  try {
    const raw = await AsyncStorage.getItem(`${prefix}:${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.createdAt !== "number") return null;
    if (Date.now() - parsed.createdAt > ttlMs) return null;
    return parsed.value ?? null;
  } catch (error) {
    console.warn("[geocode] Failed reading persisted cache", error?.message || error);
    return null;
  }
}

async function writePersistedGeoCache(prefix, key, value) {
  try {
    await AsyncStorage.setItem(`${prefix}:${key}`, JSON.stringify({
      createdAt: Date.now(),
      value,
    }));
  } catch (error) {
    console.warn("[geocode] Failed writing persisted cache", error?.message || error);
  }
}

// Main API
export async function getPlaceLabel(lat, lng, options = {}) {
  const allowExternalLookup = options?.allowExternalLookup === true;

  if (!GOOGLE_KEY || !allowExternalLookup) {
    console.warn("Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for geocoding.");
    return null;
  }

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (GEO_CACHE[cacheKey]) {
    return GEO_CACHE[cacheKey];
  }

  const persisted = await readPersistedGeoCache(GEO_PLACE_LABEL_CACHE_PREFIX, cacheKey, PLACE_LABEL_TTL_MS);
  if (persisted) {
    GEO_CACHE[cacheKey] = persisted;
    return persisted;
  }

  try {
    const geoUrl =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${lat},${lng}` +
      `&key=${GOOGLE_KEY}`;

    const geoRes = await fetch(geoUrl);
    const geoJson = await geoRes.json();

    let label = null;
    if (geoJson?.results?.length > 0) {
      const comps = geoJson.results[0].address_components || [];

      const getComp = (type) =>
        comps.find((c) => c.types.includes(type))?.long_name || null;

      // Prefer road name/number if available
      const road = getComp("route");
      const town =
        getComp("locality") ||
        getComp("postal_town") ||
        getComp("administrative_area_level_2") ||
        null;
      const houseNumber = getComp("street_number");

      // Only use house number if no road name is present
      if (road && town) {
        label = `${road}, near ${town}`;
      } else if (road) {
        label = road;
      } else if (houseNumber && town) {
        label = `${houseNumber}, near ${town}`;
      } else if (houseNumber) {
        label = houseNumber;
      } else {
        label = town;
      }
    }

    GEO_CACHE[cacheKey] = label;
    if (label) {
      writePersistedGeoCache(GEO_PLACE_LABEL_CACHE_PREFIX, cacheKey, label);
    }
    return label;
  } catch (err) {
    console.error("Error in getPlaceLabel:", err);
    return null;
  }
}

/**
 * Geocode an address string to lat/lng coordinates
 * @param {string} address - Address to geocode
 * @param {Object} options - Lookup control options
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function geocodeAddress(address, options = {}) {
  const allowExternalLookup = options?.allowExternalLookup === true;

  if (!GOOGLE_KEY || !allowExternalLookup) {
    console.warn("Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for geocoding.");
    return null;
  }

  if (!address || !address.trim()) {
    return null;
  }

  const normalizedAddress = address.trim().toLowerCase();
  const persisted = await readPersistedGeoCache(GEO_ADDRESS_CACHE_PREFIX, normalizedAddress, ADDRESS_TTL_MS);
  if (persisted && persisted.lat != null && persisted.lng != null) {
    return persisted;
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(address.trim())}` +
      `&key=${GOOGLE_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json?.results?.length > 0) {
      const location = json.results[0].geometry?.location;
      if (location?.lat != null && location?.lng != null) {
        const result = {
          lat: location.lat,
          lng: location.lng,
        };
        writePersistedGeoCache(GEO_ADDRESS_CACHE_PREFIX, normalizedAddress, result);
        return {
          lat: location.lat,
          lng: location.lng,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("Error geocoding address:", err);
    return null;
  }
}


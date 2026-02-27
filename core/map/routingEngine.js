/**
 * Unified routing engine for Coffee Rider
 * Single source of truth for:
 * - Fetching routes (TomTom, Google, cache)
 * - Styling routes based on vehicle/mode
 * - Route state management
 */

import { fetchGoogleRoute, fetchTomTomRoute } from "@core/map/utils/tomtomRouting";
import { cacheRoute, getCachedRoute } from "@core/utils/routeCache";

/**
 * Central route fetching function
 * Handles cache, vehicle-type routing, API calls
 * 
 * @param {Object} params
 * @param {Object} params.origin - {latitude, longitude}
 * @param {Object} params.destination - {latitude, longitude}
 * @param {Array} params.waypoints - [{latitude, longitude}, ...]
 * @param {String} params.travelMode - 'car', 'bike', 'pedestrian', 'motorcycle'
 * @param {String} params.routeType - 'fastest', 'shortest', 'scenic', etc
 * @param {String} params.routeTypeMap - Map of route types to config
 * @param {Boolean} params.useCache - Whether to check cache (default true, false for Follow Me)
 * @param {String} params.customHilliness - 'low', 'normal', 'high' for custom routes
 * @param {String} params.customWindingness - 'low', 'normal', 'high' for custom routes
 * @returns {Promise<Object>} Route data: {polyline: [...], distanceMeters, durationSeconds, steps: [...]}
 * @throws {Error} If route fetch fails
 */
export async function fetchRoute({
  origin,
  destination,
  waypoints = [],
  travelMode = 'car',
  routeType = 'fastest',
  routeTypeMap = null,
  useCache = true,
  customHilliness = null,
  customWindingness = null,
  vehicleHeading = null,
}) {
  if (!origin || !destination) {
    throw new Error('Origin and destination are required');
  }

  // Check cache first if enabled
  if (useCache) {
    try {
      const cached = await getCachedRoute(origin, destination, waypoints, routeType, travelMode);
      if (cached) {
        console.log('[routingEngine] Using cached route');
        return cached;
      }
    } catch (error) {
      console.warn('[routingEngine] Cache lookup failed, continuing with fresh fetch:', error.message);
    }
  } else {
    console.log('[routingEngine] Skipping cache (Follow Me or AutoReroute)');
  }

  // Determine which API to use based on vehicle type
  // Google handles pedestrian/bike better, TomTom handles car/motorcycle + complex routing
  const useGoogleAPI = travelMode === 'pedestrian' || travelMode === 'bike';
  
  console.log('[routingEngine] Fetching route via', useGoogleAPI ? 'Google' : 'TomTom', `(${travelMode})`);

  let result;
  if (useGoogleAPI) {
    // Convert travelMode to Google mode
    const googleMode = travelMode === 'bike' ? 'bicycling' : 'walking';
    result = await fetchGoogleRoute(origin, destination, waypoints, googleMode);
  } else {
    // Use TomTom for car and motorcycle
    result = await fetchTomTomRoute(
      origin,
      destination,
      waypoints,
      travelMode,
      routeType,
      routeTypeMap,
      customHilliness,
      customWindickness,
      vehicleHeading
    );
  }

  if (!result?.polyline) {
    throw new Error('No polyline in route result');
  }

  // Cache the fresh result
  if (useCache) {
    try {
      await cacheRoute(origin, destination, waypoints, routeType, travelMode, result);
    } catch (error) {
      console.warn('[routingEngine] Failed to cache route:', error.message);
      // Continue anyway - caching is optimization, not critical
    }
  }

  return result;
}

/**
 * Get polyline styling based on vehicle type and route type
 * Returns the colors and widths for rendering
 * 
 * @param {String} travelMode - 'car', 'bike', 'pedestrian', 'motorcycle'
 * @param {Object} theme - Theme colors from app
 * @param {Boolean} isNavigationMode - Whether in active navigation (affects width/opacity)
 * @returns {Object} {mainColor, outlineColor, mainWidth, outlineWidth}
 */
export function getRouteStyle(travelMode, theme, isNavigationMode = false) {
  const styles = {
    pedestrian: {
      mainColor: '#4CAF50',      // Green
      outlineColor: '#2E7D32',   // Dark green
      mainWidth: isNavigationMode ? 10 : 6,
      outlineWidth: isNavigationMode ? 12 : 8,
    },
    bike: {
      mainColor: '#CE93D8',      // Light purple
      outlineColor: '#7B1FA2',   // Dark purple
      mainWidth: isNavigationMode ? 10 : 6,
      outlineWidth: isNavigationMode ? 12 : 8,
    },
    car: {
      mainColor: '#DC2626',      // Red
      outlineColor: '#7F1D1D',   // Dark red
      mainWidth: isNavigationMode ? 10 : 6,
      outlineWidth: isNavigationMode ? 12 : 8,
    },
    motorcycle: {
      mainColor: '#42A5F5',      // Light blue
      outlineColor: '#1565C0',   // Dark blue
      mainWidth: isNavigationMode ? 10 : 6,
      outlineWidth: isNavigationMode ? 12 : 8,
    },
  };

  return styles[travelMode] || styles.car;
}

/**
 * Determine if this vehicle type needs outline rendering
 * Pedestrian and bike routes have outline layers for visibility
 * 
 * @param {String} travelMode - 'car', 'bike', 'pedestrian', 'motorcycle'
 * @returns {Boolean}
 */
export function shouldRenderOutline(travelMode) {
  return travelMode === 'pedestrian' || travelMode === 'bike';
}

/**
 * Get traveled/remaining polyline split for Follow Me mode
 * 
 * @param {Array} polyline - Full route polyline
 * @param {Object} userLocation - Current user location
 * @returns {Object} {traveledPolyline: [...], remainingPolyline: [...]}
 */
export function splitPolylineByLocation(polyline, userLocation) {
  if (!polyline || !userLocation) {
    return { traveledPolyline: [], remainingPolyline: polyline || [] };
  }

  // Find closest point on polyline to user
  let closestIdx = 0;
  let minDistance = Infinity;

  for (let i = 0; i < polyline.length; i++) {
    const dist = calculateDistance(userLocation, polyline[i]);
    if (dist < minDistance) {
      minDistance = dist;
      closestIdx = i;
    }
  }

  return {
    traveledPolyline: polyline.slice(0, closestIdx + 1),
    remainingPolyline: polyline.slice(closestIdx),
  };
}

/**
 * Simple distance calculation between two coordinates (in meters)
 * @private
 */
function calculateDistance(coord1, coord2) {
  const lat1 = coord1.latitude || coord1.lat;
  const lng1 = coord1.longitude || coord1.lng;
  const lat2 = coord2.latitude || coord2.lat;
  const lng2 = coord2.longitude || coord2.lng;

  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

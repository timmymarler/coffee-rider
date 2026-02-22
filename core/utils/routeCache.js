import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = '@coffee-rider/route_cache_';
const CACHE_METADATA_KEY = '@coffee-rider/route_cache_metadata';
const MAX_CACHED_ROUTES = 50; // Limit cache size to prevent storage bloat
const CACHE_EXPIRY_DAYS = 7; // Routes expire after 7 days

/**
 * Generate a cache key from route parameters
 * @param {Object} startPoint - {latitude, longitude}
 * @param {Object} endPoint - {latitude, longitude}
 * @param {Array} waypoints - Array of waypoint objects
 * @param {String} routeType - Route type (fastest, shortest, etc)
 * @param {String} travelMode - Travel mode (car, bike, pedestrian, motorcycle)
 * @returns {String} Cache key
 */
function generateCacheKey(startPoint, endPoint, waypoints, routeType, travelMode) {
  // Round coordinates to 5 decimal places (~1m precision) to handle variations while distinguishing different routes
  const roundCoord = (coord) => {
    if (!coord) return '0,0';
    return `${(coord.latitude || coord.lat).toFixed(5)},${(coord.longitude || coord.lng).toFixed(5)}`;
  };

  // Include waypoint count and coordinates for more specific cache keys
  // Different waypoint sets should produce different cache keys
  const waypointStr = (waypoints || [])
    .map((wp, idx) => `${idx}:${roundCoord(wp)}`)
    .join(';');

  // Create key without Buffer (not available in React Native)
  // Use a simple hash-like key combining all parameters
  // Include travelMode to ensure different vehicle types don't share cached routes
  const key = `${roundCoord(startPoint)}_${roundCoord(endPoint)}_wp${waypoints?.length || 0}_${waypointStr}_${routeType || 'default'}_${travelMode || 'car'}`;
  return CACHE_KEY_PREFIX + key.replace(/[.,\-;:]/g, '_').substring(0, 150);
}

/**
 * Save a route to local cache
 * @param {Object} startPoint - {latitude, longitude}
 * @param {Object} endPoint - {latitude, longitude}
 * @param {Array} waypoints - Array of waypoint objects
 * @param {String} routeType - Route type identifier
 * @param {String} travelMode - Travel mode (car, bike, pedestrian, motorcycle)
 * @param {Object} routeData - The complete route response from TomTom
 */
export async function cacheRoute(startPoint, endPoint, waypoints, routeType, travelMode, routeData) {
  try {
    if (!routeData || !routeData.polyline) {
      console.warn('[RouteCache] Refusing to cache - no polyline in route data');
      return false;
    }

    const cacheKey = generateCacheKey(startPoint, endPoint, waypoints, routeType, travelMode);
    const timestamp = Date.now();

    // Only cache essential route metadata, not the full polyline
    // (polyline can be re-fetched if needed, but metadata is lightweight)
    const cacheEntry = {
      key: cacheKey,
      timestamp,
      startPoint,
      endPoint,
      waypoints: waypoints || [],
      routeType,
      travelMode,
      distanceMeters: routeData.distanceMeters,
      durationSeconds: routeData.durationSeconds,
      expiresAt: timestamp + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    };

    // Save the route
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));

    // Update metadata
    const metadata = await getCacheMetadata();
    const existingIndex = metadata.routes.findIndex(r => r.key === cacheKey);

    if (existingIndex >= 0) {
      metadata.routes[existingIndex] = {
        key: cacheKey,
        timestamp,
        distanceMeters: routeData.distanceMeters,
        durationSeconds: routeData.durationSeconds,
      };
    } else {
      metadata.routes.push({
        key: cacheKey,
        timestamp,
        distanceMeters: routeData.distanceMeters,
        durationSeconds: routeData.durationSeconds,
      });
    }

    // Remove oldest entries if we exceed max
    if (metadata.routes.length > MAX_CACHED_ROUTES) {
      metadata.routes.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = metadata.routes.splice(0, metadata.routes.length - MAX_CACHED_ROUTES);

      for (const entry of toRemove) {
        await AsyncStorage.removeItem(entry.key);
      }
      console.log(`[RouteCache] Cleaned up ${toRemove.length} old routes, keeping ${metadata.routes.length}`);
    }

    metadata.lastUpdated = timestamp;
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));

    console.log(`[RouteCache] Cached route: ${cacheKey.substring(0, 20)}...`);
    return true;
  } catch (error) {
    // Fail gracefully - caching is nice-to-have, not critical
    console.warn('[RouteCache] Warning: Could not cache route. Storage may be full. Continuing without cache.', error.message);
    return false;
  }
}

/**
 * Retrieve a cached route
 * @param {Object} startPoint - {latitude, longitude}
 * @param {Object} endPoint - {latitude, longitude}
 * @param {Array} waypoints - Array of waypoint objects
 * @param {String} routeType - Route type identifier
 * @param {String} travelMode - Travel mode (car, bike, pedestrian, motorcycle)
 * @returns {Object|null} Cached route data or null if not found/expired
 */
export async function getCachedRoute(startPoint, endPoint, waypoints, routeType, travelMode) {
  try {
    const cacheKey = generateCacheKey(startPoint, endPoint, waypoints, routeType, travelMode);
    const cached = await AsyncStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    const cacheEntry = JSON.parse(cached);

    // Check if expired
    if (cacheEntry.expiresAt && cacheEntry.expiresAt < Date.now()) {
      console.log('[RouteCache] Route expired, removing from cache');
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }

    console.log('[RouteCache] Cache hit for route');
    return cacheEntry.routeData;
  } catch (error) {
    console.error('[RouteCache] Error retrieving cached route:', error);
    return null;
  }
}

/**
 * Get all cached routes metadata (for displaying available offline routes)
 * @returns {Array} Array of cached route metadata
 */
export async function getCachedRoutes() {
  try {
    const metadata = await getCacheMetadata();
    const now = Date.now();

    // Filter out expired routes
    const validRoutes = metadata.routes.filter(r => !r.expiryTime || r.expiryTime > now);

    if (validRoutes.length !== metadata.routes.length) {
      // Clean up expired routes
      const expiredKeys = metadata.routes
        .filter(r => r.expiryTime && r.expiryTime <= now)
        .map(r => r.key);

      for (const key of expiredKeys) {
        await AsyncStorage.removeItem(key);
      }

      metadata.routes = validRoutes;
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    }

    return validRoutes;
  } catch (error) {
    console.error('[RouteCache] Error getting cached routes:', error);
    return [];
  }
}

/**
 * Load a specific cached route by key
 * @param {String} cacheKey - The cache key
 * @returns {Object|null} The cached route data
 */
export async function loadCachedRouteByKey(cacheKey) {
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (!cached) return null;

    const cacheEntry = JSON.parse(cached);

    // Check expiry
    if (cacheEntry.expiresAt && cacheEntry.expiresAt < Date.now()) {
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }

    return cacheEntry.routeData;
  } catch (error) {
    console.error('[RouteCache] Error loading cached route by key:', error);
    return null;
  }
}

/**
 * Clear all cached routes
 */
export async function clearRouteCache() {
  try {
    const metadata = await getCacheMetadata();

    for (const entry of metadata.routes) {
      await AsyncStorage.removeItem(entry.key);
    }

    metadata.routes = [];
    metadata.lastUpdated = Date.now();
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));

    console.log('[RouteCache] Cleared all cached routes');
    return true;
  } catch (error) {
    console.error('[RouteCache] Error clearing cache:', error);
    return false;
  }
}

/**
 * Get cache metadata
 * @returns {Object} Metadata object
 */
async function getCacheMetadata() {
  try {
    const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    if (metadata) {
      return JSON.parse(metadata);
    }
  } catch (error) {
    console.warn('[RouteCache] Error reading metadata:', error);
  }

  return { routes: [], lastUpdated: 0 };
}

/**
 * Get cache size info
 * @returns {Object} {totalRoutes, oldestCacheTime, newestCacheTime}
 */
export async function getCacheSizeInfo() {
  try {
    const metadata = await getCacheMetadata();
    if (metadata.routes.length === 0) {
      return { totalRoutes: 0, oldestCacheTime: null, newestCacheTime: null };
    }

    const timestamps = metadata.routes
      .map(r => r.timestamp)
      .filter(t => t != null)
      .sort((a, b) => a - b);

    return {
      totalRoutes: metadata.routes.length,
      oldestCacheTime: timestamps[0] || null,
      newestCacheTime: timestamps[timestamps.length - 1] || null,
    };
  } catch (error) {
    console.error('[RouteCache] Error getting cache size:', error);
    return { totalRoutes: 0, oldestCacheTime: null, newestCacheTime: null };
  }
}

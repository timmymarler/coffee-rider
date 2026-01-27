import Constants from "expo-constants";
import { decode } from "@mapbox/polyline";

/**
 * Fetch route from TomTom Routing API
 * @param {Object} origin - {latitude, longitude}
 * @param {Object} destination - {latitude, longitude}
 * @param {Array} waypoints - [{latitude, longitude}, ...] (optional)
 * @param {string} vehicleType - 'car', 'pedestrian', 'bike', 'truck', 'taxi', 'bus', 'motorcycle' (optional, default 'car')
 * @returns {Promise<Object>} Route data with polyline, distance, duration
 */
export async function fetchTomTomRoute(origin, destination, waypoints = [], vehicleType = "car") {
  const tomtomApiKey = Constants.expoConfig?.extra?.tomtomApiKey;

  if (!tomtomApiKey) {
    throw new Error("TomTom API key not configured");
  }

  if (!origin || !destination) {
    throw new Error("Origin and destination are required");
  }

  try {
    // Build waypoints string (TomTom format: lat,lng:lat,lng)
    let waypointsStr = "";
    if (waypoints && waypoints.length > 0) {
      waypointsStr = waypoints
        .map((wp) => `${wp.latitude},${wp.longitude}`)
        .join(":");
      waypointsStr = ":" + waypointsStr;
    }

    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    // TomTom Routing API endpoint
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${originStr}:${destStr}${waypointsStr}/json`;

    const params = new URLSearchParams({
      key: tomtomApiKey,
      vehicleType: vehicleType,
      computeTravelTimeFor: "all",
      traffic: "true",
      instructionsType: "text",
      language: "en-GB",
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      throw new Error(`TomTom API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error("No route found");
    }

    const route = data.routes[0];
    const legs = route.legs || [];

    // Extract polyline points from legs
    let allPoints = [];
    legs.forEach((leg) => {
      if (leg.points) {
        allPoints = allPoints.concat(
          leg.points.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }))
        );
      }
    });

    // Fallback to summary points if detailed points not available
    if (allPoints.length === 0 && route.summary) {
      allPoints = [origin, destination];
    }

    return {
      polyline: allPoints, // Return as array of {latitude, longitude} objects
      distance: route.summary?.lengthInMeters || 0,
      duration: route.summary?.travelTimeInSeconds || 0,
      durationInTraffic: route.summary?.travelTimeInSecondsTraffic || route.summary?.travelTimeInSeconds || 0,
      legs: legs,
      guidance: route.guidance || [],
      rawRoute: route, // Store raw data for reference
    };
  } catch (error) {
    console.error("[tomtomRouting] Error fetching route:", error);
    throw error;
  }
}

/**
 * Fetch Matrix (distance/duration between multiple points)
 * Useful for checking distances to multiple places
 * @param {Object} origin - {latitude, longitude}
 * @param {Array} destinations - [{latitude, longitude}, ...]
 * @returns {Promise<Array>} Array of {distance, duration} for each destination
 */
export async function fetchTomTomMatrix(origin, destinations) {
  const tomtomApiKey = Constants.expoConfig?.extra?.tomtomApiKey;

  if (!tomtomApiKey) {
    throw new Error("TomTom API key not configured");
  }

  if (!origin || !destinations || destinations.length === 0) {
    throw new Error("Origin and destinations are required");
  }

  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = destinations
      .map((d) => `${d.latitude},${d.longitude}`)
      .join(":");

    const url = `https://api.tomtom.com/routing/1/matrix/json`;

    const payload = {
      origins: [{ point: { latitude: origin.latitude, longitude: origin.longitude } }],
      destinations: destinations.map((d) => ({
        point: { latitude: d.latitude, longitude: d.longitude },
      })),
      vehicleType: "car",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Add API key as header for matrix API
    const urlWithKey = `${url}?key=${tomtomApiKey}`;
    const responseWithKey = await fetch(urlWithKey, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!responseWithKey.ok) {
      throw new Error(`TomTom Matrix API error: ${responseWithKey.status}`);
    }

    const data = await responseWithKey.json();

    if (!data.matrix) {
      throw new Error("Invalid matrix response");
    }

    return data.matrix;
  } catch (error) {
    console.error("[tomtomMatrix] Error fetching matrix:", error);
    throw error;
  }
}

/**
 * Get bike-friendly route (optimize for cyclists)
 * @param {Object} origin - {latitude, longitude}
 * @param {Object} destination - {latitude, longitude}
 * @returns {Promise<Object>} Route optimized for bikes
 */
export async function fetchBikeFriendlyRoute(origin, destination) {
  return fetchTomTomRoute(origin, destination, [], "bike");
}

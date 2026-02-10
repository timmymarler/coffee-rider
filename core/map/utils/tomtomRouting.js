import Constants from "expo-constants";

/**
 * Fetch route from TomTom Routing API
 * @param {Object} origin - {latitude, longitude}
 * @param {Object} destination - {latitude, longitude}
 * @param {Array} waypoints - [{latitude, longitude}, ...] (optional)
 * @param {string} vehicleType - 'car', 'pedestrian', 'bike', 'motorcycle' (optional, default 'car')
 * @param {string} routeTypeId - Route type ID like 'scenic', 'adventure', 'fastest' (optional)
 * @param {Object} routeTypeMap - Map of route type IDs to {tomtomRouteType, hilliness, windingness} (optional)
 * @param {string} customHilliness - Override hilliness for custom routes (optional, 'low', 'normal', 'high')
 * @param {string} customWindingness - Override windingness for custom routes (optional, 'low', 'normal', 'high')
 * @returns {Promise<Object>} Route data with polyline, distance, duration
 */
export async function fetchTomTomRoute(origin, destination, waypoints = [], vehicleType = "car", routeTypeId = null, routeTypeMap = null, customHilliness = null, customWindingness = null) {
  // Map vehicle types to appropriate TomTom travelMode and avoid preferences
  // Note: avoid parameter accepts single values only. Valid values:
  // tollRoads, motorways, ferries, unpavedRoads, carpools, alreadyUsedRoads, borderCrossings, tunnels, carTrains, lowEmissionZones
  const vehicleConfigMap = {
    car: {
      travelMode: "car",
      defaultRouteType: "fastest",
      defaultAvoid: "ferries",
    },
    motorcycle: {
      travelMode: "motorcycle",
      defaultRouteType: "thrilling",
      defaultAvoid: "motorways",
    },
    bike: {
      travelMode: "bike",
      defaultRouteType: "thrilling",
      defaultAvoid: "motorways",
    },
    pedestrian: {
      travelMode: "pedestrian",
      defaultRouteType: "shortest",
      defaultAvoid: "",
    },
    default: {
      travelMode: "car",
      defaultRouteType: "fastest",
      defaultAvoid: "",
    }
  };
  
  const vehicleConfig = vehicleConfigMap[vehicleType] || vehicleConfigMap.default;
  
  // Determine final route type, hilliness, and windingness parameters
  let tomtomRouteType = vehicleConfig.defaultRouteType;
  let hilliness = null;
  let windingness = null;
  
  if (routeTypeId && routeTypeMap && routeTypeMap[routeTypeId]) {
    const routeConfig = routeTypeMap[routeTypeId];
    tomtomRouteType = routeConfig.tomtomRouteType || tomtomRouteType;
    hilliness = routeConfig.hilliness || null;
    windingness = routeConfig.windingness || null;
  }
  
  // Override with custom values if this is a custom route type
  if (routeTypeId === "custom") {
    hilliness = customHilliness || hilliness;
    windingness = customWindingness || windingness;
  }
  
  const tomtomApiKey = Constants.expoConfig?.extra?.tomtomApiKey;

  if (!tomtomApiKey) {
    throw new Error("TomTom API key not configured");
  }

  if (!origin || !destination) {
    throw new Error("Origin and destination are required");
  }

  // Validate coordinates
  if (typeof origin.latitude !== 'number' || typeof origin.longitude !== 'number' ||
      typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number') {
    console.error('[tomtomRouting] Invalid coordinate types:', {
      origin: { type: typeof origin.latitude, lat: origin.latitude, lng: origin.longitude },
      destination: { type: typeof destination.latitude, lat: destination.latitude, lng: destination.longitude }
    });
    throw new Error(`Invalid coordinates: origin or destination has non-numeric values`);
  }

  // Validate coordinate ranges
  const validateCoord = (name, coord) => {
    if (Math.abs(coord.latitude) > 90 || Math.abs(coord.longitude) > 180) {
      throw new Error(`${name} coordinates out of bounds: lat=${coord.latitude}, lng=${coord.longitude}`);
    }
  };
  
  validateCoord('Origin', origin);
  validateCoord('Destination', destination);
  waypoints?.forEach((wp, i) => {
    if (wp.latitude !== undefined && wp.longitude !== undefined) {
      validateCoord(`Waypoint ${i}`, wp);
    }
  });

  try {
    // Build waypoints string (TomTom format: lat,lng:lat,lng)
    // Note: In TomTom routing, waypoints must come BEFORE destination
    // Format: origin:waypoint1:waypoint2:...:destination
    let waypointsStr = "";
    if (waypoints && waypoints.length > 0) {
      waypointsStr = waypoints
        .map((wp) => `${wp.latitude},${wp.longitude}`)
        .join(":");
      waypointsStr = ":" + waypointsStr;
    }

    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    // TomTom Routing API endpoint - waypoints go BETWEEN origin and destination
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${originStr}${waypointsStr}:${destStr}/json`;

    console.log('[tomtomRouting] Request URL:', url);
    console.log('[tomtomRouting] Vehicle config:', {
      vehicleType: vehicleType,
      routeTypeId: routeTypeId,
      travelMode: vehicleConfig.travelMode,
      routeType: tomtomRouteType,
      hilliness: hilliness || 'none',
      windingness: windingness || 'none',
      coordinates: {
        origin: { latitude: origin.latitude, longitude: origin.longitude },
        destination: { latitude: destination.latitude, longitude: destination.longitude },
        waypointsCount: waypoints?.length || 0
      }
    });

    const params = new URLSearchParams({
      key: tomtomApiKey,
      // Travel mode and route optimization based on vehicle type and route preference
      travelMode: vehicleConfig.travelMode,
      routeType: tomtomRouteType,
      computeTravelTimeFor: "all",
      traffic: "true",
      instructionsType: "coded",
      language: "en-GB",
    });
    
    // Add hilliness and windingness parameters for thrilling routes
    if (hilliness && tomtomRouteType === "thrilling") {
      params.append("hilliness", hilliness);
    }
    if (windingness && tomtomRouteType === "thrilling") {
      params.append("windingness", windingness);
    }
    
    // Note: TomTom's /calculateRoute/ endpoint includes:
    // - travelMode: car, motorcycle, bike, pedestrian
    // - routeType: fastest, shortest, short, eco, thrilling
    // - hilliness: low, normal, high (for routeType=thrilling)
    // - windingness: low, normal, high (for routeType=thrilling, level of turns)

    const response = await fetch(`${url}?${params}`);

    console.log('[tomtomRouting] API Response received. Status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tomtomRouting] API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: url
      });
      throw new Error(`TomTom API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error("No route found");
    }

    const route = data.routes[0];
    const legs = route.legs || [];
    
    console.log('[tomtomRouting] Route legs structure:', {
      legsCount: legs.length,
      legDetails: legs.map((leg, i) => ({
        index: i,
        pointsCount: leg.points?.length || 0,
        hasSummary: !!leg.summary,
      })),
      routeSummary: route.summary ? {
        lengthInMeters: route.summary.lengthInMeters,
        travelTimeInSeconds: route.summary.travelTimeInSeconds,
      } : 'none',
    });
    
    // TomTom returns guidance in route.guidance.instructions array
    let instructions = [];
    if (route.guidance && route.guidance.instructions && Array.isArray(route.guidance.instructions)) {
      instructions = route.guidance.instructions;
    }

    console.log('[tomtomRouting] Route response structure:', {
      hasGuidance: !!route.guidance,
      guidanceType: typeof route.guidance,
      instructionsLength: instructions.length,
      legsLength: legs.length,
      legKeys: legs[0] ? Object.keys(legs[0]) : [],
      guidanceKeys: route.guidance ? Object.keys(route.guidance) : [],
    });

    // Convert TomTom instructions into steps format for navigation
    // Each instruction contains maneuver type, text description, and distance
    const steps = instructions.length > 0 ? instructions.map((instr, idx) => {
      // The end point is the location of the next instruction (or current if last)
      const endPoint = idx < instructions.length - 1 ? instructions[idx + 1].point : instr.point;

      let maneuver = instr.maneuver || "STRAIGHT";
      let instruction = instr.text || "Continue";
      let extra = {};

      // Handle roundabout maneuvers
      if (maneuver.startsWith("ROUNDABOUT")) {
        // TomTom may provide exit number in instruction or as a property
        const exitMatch = instruction.match(/exit (\d+)/i);
        let exitNumber = instr.exitNumber || (exitMatch ? parseInt(exitMatch[1], 10) : undefined);
        if (maneuver === "ROUNDABOUT_ENTER") {
          instruction = exitNumber
            ? `Enter roundabout and take exit ${exitNumber}`
            : "Enter roundabout";
          extra.exitNumber = exitNumber;
        } else if (maneuver === "ROUNDABOUT_EXIT") {
          instruction = exitNumber
            ? `Exit roundabout at exit ${exitNumber}`
            : "Exit roundabout";
          extra.exitNumber = exitNumber;
        }
      } else if (maneuver === "STRAIGHT") {
        // Only use 'continue straight' if not approaching a roundabout
        const nextInstr = instructions[idx + 1];
        if (nextInstr) {
          const nextManeuver = nextInstr.maneuver || "";
          if (nextManeuver.startsWith("ROUNDABOUT")) {
            instruction = "Approach roundabout";
          } else if (nextManeuver.startsWith("TURN")) {
            instruction = "Continue straight to next junction";
          } else {
            instruction = "Continue straight";
          }
        }
      }

      return {
        maneuver,
        instruction,
        distance: instr.distance || (idx < instructions.length - 1 ? 100 : 0),
        position: instr.point, // Where this instruction starts
        end: endPoint, // Where this instruction ends (at next maneuver point)
        ...extra,
      };
    }) : [];

    console.log('[tomtomRouting] Converted instructions to steps:', {
      instructionsCount: instructions.length,
      stepsCount: steps.length,
      firstInstruction: instructions[0] || 'no instructions',
      firstStep: steps[0] || 'no steps',
    });

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

    console.log('[tomtomRouting] Extracted polyline:', {
      legsCount: legs.length,
      totalPoints: allPoints.length,
      firstPoint: allPoints[0] || null,
      lastPoint: allPoints[allPoints.length - 1] || null
    });

    // Fallback to summary points if detailed points not available
    if (allPoints.length === 0 && route.summary) {
      allPoints = [origin, destination];
    }

    console.log('[tomtomRouting] Returning result with polyline points:', allPoints.length);

    return {
      polyline: allPoints, // Return as array of {latitude, longitude} objects
      distance: route.summary?.lengthInMeters || 0,
      duration: route.summary?.travelTimeInSeconds || 0,
      durationInTraffic: route.summary?.travelTimeInSecondsTraffic || route.summary?.travelTimeInSeconds || 0,
      legs: legs,
      guidance: instructions, // Array of TomTom instruction objects
      steps: steps, // Converted instructions into steps format for navigation
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

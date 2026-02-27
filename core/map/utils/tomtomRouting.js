import polyline from "@mapbox/polyline";
import Constants from "expo-constants";

/**
 * Fetch route from Google Directions API (best for pedestrian and cycling routing)
 * @param {Object} origin - {latitude, longitude}
 * @param {Object} destination - {latitude, longitude}
 * @param {Array} waypoints - [{latitude, longitude}, ...] (optional)
 * @param {string} mode - 'walking' or 'bicycling' (default: 'walking')
 * @returns {Promise<Object>} Route data with polyline, distance, duration
 */
export async function fetchGoogleRoute(origin, destination, waypoints = [], mode = 'walking') {
  const googleMapsApiKey = Constants.expoConfig?.extra?.googleMapsApiKey;

  if (!googleMapsApiKey) {
    throw new Error("Google Maps API key not configured");
  }

  try {
    // Format: origin=lat,lng&destination=lat,lng&waypoints=lat,lng|lat,lng
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;
    
    let waypointsStr = "";
    if (waypoints && waypoints.length > 0) {
      waypointsStr = `&waypoints=${waypoints
        .map((wp) => `${wp.latitude},${wp.longitude}`)
        .join("|")}`;
    }

    // For pedestrians, avoid highways to prioritize footpaths and local roads
    const avoidParam = mode === 'walking' ? '&avoid=highways&region=GB' : '';
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}${waypointsStr}&mode=${mode}${avoidParam}&alternatives=true&key=${googleMapsApiKey}`;

    const modeLabel = mode === 'walking' ? 'pedestrian' : 'cycling';
    console.log(`[googleRouting] Fetching ${modeLabel} route from Google`);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[googleRouting] API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Google Directions API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      throw new Error(`Google Directions API: ${data.status}`);
    }

    // For pedestrian routes, pick the best alternative that avoids major roads
    let selectedRouteIndex = 0;
    if (mode === 'walking' && data.routes.length > 1) {
      // Score routes by checking for major road keywords in instructions
      let bestScore = Infinity;
      data.routes.forEach((route, idx) => {
        let score = route.legs.reduce((sum, leg) => {
          return sum + (leg.steps || []).reduce((stepSum, step) => {
            const instruction = (step.html_instructions || '').toLowerCase();
            // Penalize routes mentioning A-roads, motorways, highways
            let penalty = 0;
            if (instruction.includes('a ') || instruction.match(/\ba\d/)) penalty += 100;
            if (instruction.includes('motorway') || instruction.includes('m ')) penalty += 200;
            if (instruction.includes('highway')) penalty += 50;
            return stepSum + penalty;
          }, 0);
        }, 0);
        console.log(`[googleRouting] Route ${idx}: major road score ${score}`);
        if (score < bestScore) {
          bestScore = score;
          selectedRouteIndex = idx;
        }
      });
      console.log(`[googleRouting] Selected route ${selectedRouteIndex} (score: ${bestScore})`);
    }

    const route = data.routes[selectedRouteIndex];
    const legs = route.legs || [];

    console.log('[googleRouting] Got route with', legs.length, 'legs');

    // Decode Google's encoded polyline
    let allPoints = [];
    if (route.overview_polyline && route.overview_polyline.points) {
      try {
        const decoded = polyline.decode(route.overview_polyline.points);
        allPoints = decoded.map((p) => ({
          latitude: p[0],
          longitude: p[1],
        }));
      } catch (decodeError) {
        console.error('[googleRouting] Error decoding polyline:', decodeError);
        // Fallback: use leg points
        legs.forEach((leg) => {
          if (leg.steps) {
            leg.steps.forEach((step) => {
              if (step.polyline && step.polyline.points) {
                try {
                  const decoded = polyline.decode(step.polyline.points);
                  decoded.forEach((p) => {
                    allPoints.push({ latitude: p[0], longitude: p[1] });
                  });
                } catch (e) {
                  // Skip problematic polylines
                }
              }
            });
          }
        });
      }
    }

    // Fallback to leg start/end points if no polyline
    if (allPoints.length === 0) {
      allPoints = [origin];
      legs.forEach((leg) => {
        if (leg.end_location) {
          allPoints.push({
            latitude: leg.end_location.lat,
            longitude: leg.end_location.lng,
          });
        }
      });
    }

    // Convert Google steps to consistent step format
    const steps = [];
    legs.forEach((leg) => {
      if (leg.steps && Array.isArray(leg.steps)) {
        leg.steps.forEach((step, idx) => {
          steps.push({
            maneuver: step.maneuver || "STRAIGHT",
            instruction: step.html_instructions
              ?.replace(/<[^>]*>/g, "") // Strip HTML tags
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'") || "Continue",
            distance: step.distance?.value || 0,
            position: {
              latitude: step.start_location.lat,
              longitude: step.start_location.lng,
            },
            end: {
              latitude: step.end_location.lat,
              longitude: step.end_location.lng,
            },
          });
        });
      }
    });

    // Calculate total distance and duration
    let totalDistance = 0;
    let totalDuration = 0;
    legs.forEach((leg) => {
      if (leg.distance) totalDistance += leg.distance.value;
      if (leg.duration) totalDuration += leg.duration.value;
    });

    console.log('[googleRouting] Route summary:', {
      distance: totalDistance,
      duration: totalDuration,
      polylinePoints: allPoints.length,
      stepsCount: steps.length,
    });

    return {
      polyline: allPoints,
      distance: totalDistance, // in meters
      duration: totalDuration, // in seconds
      durationInTraffic: totalDuration, // Google walking doesn't have traffic
      legs: legs,
      guidance: steps, // Use steps as guidance for walking
      steps: steps,
      rawRoute: route,
    };
  } catch (error) {
    console.error("[googleRouting] Error fetching route:", error);
    throw error;
  }
}

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
export async function fetchTomTomRoute(origin, destination, waypoints = [], vehicleType = "car", routeTypeId = null, routeTypeMap = null, customHilliness = null, customWindingness = null, vehicleHeading = null) {
  // Use Google Maps API for pedestrian routing (better depth of routing)
  if (vehicleType === "pedestrian") {
    console.log('[tomtomRouting] Delegating pedestrian routing to Google Maps API');
    return fetchGoogleRoute(origin, destination, waypoints, 'walking');
  }
  
  // Use Google Maps for scenic cycling routes (better at finding dedicated cycle paths)
  if (vehicleType === "bike" && (routeTypeId === "curvy" || routeTypeId === "scenic")) {
    console.log('[tomtomRouting] Using Google Maps for scenic cycling route');
    return fetchGoogleRoute(origin, destination, waypoints, 'bicycling');
  }

  // Map vehicle types to appropriate TomTom travelMode and avoid preferences
  // Note: avoid parameter accepts single values only. Valid values:
  // tollRoads, motorways, ferries, unpavedRoads, carpools, alreadyUsedRoads, borderCrossings, tunnels, carTrains, lowEmissionZones
  // Note: bike and pedestrian are handled by Google Maps API above
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
      travelMode: "car",
      defaultRouteType: "shortest",
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
    console.error('[tomtomRouting] Constants.expoConfig:', Constants.expoConfig);
    console.error('[tomtomRouting] Constants.expoConfig?.extra:', Constants.expoConfig?.extra);
    throw new Error("TomTom API key not configured. Check console logs for config details.");
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
      instructionsType: "coded",  // Get structured instruction codes (e.g., ROUNDABOUT_1, ROUNDABOUT_2)
      language: "en-GB",
    });
    
    // Add vehicle heading if provided (helps prevent backtracking during reroutes)
    // Heading is in degrees: 0=North, 90=East, 180=South, 270=West
    if (vehicleHeading !== null && typeof vehicleHeading === 'number' && vehicleHeading >= 0 && vehicleHeading < 360) {
      params.append("vehicleHeading", Math.round(vehicleHeading));
    }
    
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
    
    // Log all instructions with full details
    console.log('[tomtomRouting] ALL INSTRUCTIONS FROM TOMTOM:');
    instructions.forEach((instr, idx) => {
      console.log(`  [${idx}]:`, JSON.stringify(instr, null, 2));
      if (instr.maneuver && instr.maneuver.includes('ROUNDABOUT')) {
        console.log(`    --> ROUNDABOUT FOUND: maneuver=${instr.maneuver}, all keys:`, Object.keys(instr));
      }
    });

    // Convert TomTom instructions into steps format for navigation
    // Each instruction contains maneuver type, text description, and distance
    const steps = instructions.length > 0 ? instructions.map((instr, idx) => {
      // The end point is the location of the next instruction (or current if last)
      const endPoint = idx < instructions.length - 1 ? instructions[idx + 1].point : instr.point;

      let maneuver = instr.maneuver || "STRAIGHT";
      let instruction = instr.text || "Continue";
      let extra = {};

      // Handle roundabout maneuvers and extract exit number
      // TomTom uses codes like: ROUNDABOUT_0, ROUNDABOUT_1, ROUNDABOUT_2, etc.
      // Or simply: ROUNDABOUT, ROUNDABOUT_LEFT, ROUNDABOUT_RIGHT, ROUNDABOUT_STRAIGHT
      if (maneuver.includes("ROUNDABOUT")) {
        let exitNumber = null;
        
        // Priority 1: Direct roundaboutExitNumber field (this is what TomTom provides!)
        if (typeof instr.roundaboutExitNumber === "number" && instr.roundaboutExitNumber > 0) {
          exitNumber = instr.roundaboutExitNumber;
          console.log('[tomtomRouting] Roundabout: Found roundaboutExitNumber field:', exitNumber);
        }
        
        // Priority 2: Alternative exitNumber field
        if (!exitNumber && typeof instr.exitNumber === "number" && instr.exitNumber > 0) {
          exitNumber = instr.exitNumber;
          console.log('[tomtomRouting] Roundabout: Found exitNumber field:', exitNumber);
        }
        
        // Priority 3: Extract from maneuver code (e.g., "ROUNDABOUT_2" -> 2)
        if (!exitNumber) {
          const roundaboutMatch = maneuver.match(/ROUNDABOUT[_-]?(\d+)/i);
          if (roundaboutMatch) {
            exitNumber = parseInt(roundaboutMatch[1], 10);
            console.log('[tomtomRouting] Roundabout: Extracted from maneuver code:', exitNumber, 'from:', maneuver);
          }
        }
        
        // Set instruction text based on what we found
        if (exitNumber && exitNumber > 0) {
          instruction = `Take exit ${exitNumber}`;
          console.log('[tomtomRouting] Roundabout: Final instruction with number:', instruction);
        } else if (maneuver.includes("STRAIGHT")) {
          instruction = "Go straight through roundabout";
          console.log('[tomtomRouting] Roundabout: Direct straight through');
        } else if (maneuver.includes("LEFT")) {
          instruction = "Exit left from roundabout";
          console.log('[tomtomRouting] Roundabout: Exit left (no number)');
        } else if (maneuver.includes("RIGHT")) {
          instruction = "Exit right from roundabout";
          console.log('[tomtomRouting] Roundabout: Exit right (no number)');
        } else {
          instruction = "Enter roundabout";
          console.log('[tomtomRouting] Roundabout: Enter (no exit info)');
        }
        
        extra.roundaboutExitNumber = exitNumber;
        
        // Debug log to see all available fields in instr
        console.log('[tomtomRouting] Roundabout instruction object keys:', Object.keys(instr));
        console.log('[tomtomRouting] Full roundabout instruction:', JSON.stringify(instr, null, 2));
      } else if (maneuver === "STRAIGHT") {
        // Only use 'continue straight' if not approaching a roundabout
        const nextInstr = instructions[idx + 1];
        if (nextInstr) {
          const nextManeuver = nextInstr.maneuver || "";
          if (nextManeuver.includes("ROUNDABOUT")) {
            instruction = "Approach roundabout";
          } else if (nextManeuver.includes("TURN")) {
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
    
    // Log all steps with their instructions for debugging
    steps.forEach((step, idx) => {
      if (step.maneuver.includes('ROUNDABOUT') || idx < 3 || idx === steps.length - 1) {
        console.log(`[tomtomRouting] Step ${idx}:`, {
          maneuver: step.maneuver,
          instruction: step.instruction,
          roundaboutExitNumber: step.roundaboutExitNumber,
          distance: step.distance,
        });
      }
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
 * @param {string} vehicleType - 'car', 'pedestrian', 'bike', 'motorcycle' (optional, default 'motorcycle')
 * @returns {Promise<Array>} Array of {distance, duration} for each destination
 */
export async function fetchTomTomMatrix(origin, destinations, vehicleType = "motorcycle") {
  const tomtomApiKey = Constants.expoConfig?.extra?.tomtomApiKey;

  if (!tomtomApiKey) {
    console.error('[fetchTomTomMatrix] Constants.expoConfig:', Constants.expoConfig);
    console.error('[fetchTomTomMatrix] Constants.expoConfig?.extra:', Constants.expoConfig?.extra);
    throw new Error("TomTom API key not configured. Check console logs for config details.");
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
      vehicleType: vehicleType,
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

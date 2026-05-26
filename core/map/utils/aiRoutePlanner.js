/**
 * AI Route Planner
 *
 * Generates intermediate waypoints and a near-origin destination to form a
 * loop route starting from the user's current location.
 *
 * No external AI API required — waypoints are placed algorithmically based on
 * the chosen personality, direction, and maximum distance, then handed off to
 * the existing TomTom routing pipeline which selects the best real roads.
 */

/** Compass bearing (degrees, 0 = north) for each named direction. null = random. */
const DIRECTION_BEARINGS = {
  any: null,
  north: 0,
  northeast: 45,
  east: 90,
  southeast: 135,
  south: 180,
  southwest: 225,
  west: 270,
  northwest: 315,
};

/**
 * Offset a coordinate along a bearing by a distance in kilometres.
 *
 * @param {{ latitude: number, longitude: number }} coord
 * @param {number} bearingDeg  – degrees clockwise from north (0–360)
 * @param {number} distanceKm
 * @returns {{ latitude: number, longitude: number }}
 */
function offsetCoordinateKm(coord, bearingDeg, distanceKm) {
  const R = 6371; // mean Earth radius, km
  const lat1 = (coord.latitude * Math.PI) / 180;
  const lon1 = (coord.longitude * Math.PI) / 180;
  const bearing = (bearingDeg * Math.PI) / 180;
  const d = distanceKm / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (lon2 * 180) / Math.PI,
  };
}

function normalizeCoord(coord) {
  if (!coord) return null;
  const latitude = Number(coord.latitude);
  const longitude = Number(coord.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceBetweenMeters(a, b) {
  const aNorm = normalizeCoord(a);
  const bNorm = normalizeCoord(b);
  if (!aNorm || !bNorm) return Infinity;

  const dLat = (bNorm.latitude - aNorm.latitude) * (Math.PI / 180);
  const dLon = (bNorm.longitude - aNorm.longitude) * (Math.PI / 180);
  const lat1 = aNorm.latitude * (Math.PI / 180);
  const lat2 = bNorm.latitude * (Math.PI / 180);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return 6371000 * c;
}

function bearingBetween(a, b) {
  const aNorm = normalizeCoord(a);
  const bNorm = normalizeCoord(b);
  if (!aNorm || !bNorm) return 0;

  const lat1 = (aNorm.latitude * Math.PI) / 180;
  const lat2 = (bNorm.latitude * Math.PI) / 180;
  const dLon = ((bNorm.longitude - aNorm.longitude) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Loop profile controls the circular guide-arc used to keep routes loop-like.
 *
 * radiusFraction: approximate loop radius relative to requested max distance.
 * arcDegrees: how far around the circle the route should travel before returning.
 *
 * Higher arcDegrees creates fuller loops and less chance of self-crossing.
 */
const LOOP_PROFILE_BY_PERSONALITY = {
  fast:        { radiusFraction: 0.16, arcDegrees: 240 },
  scenic:      { radiusFraction: 0.18, arcDegrees: 260 },
  curvy:       { radiusFraction: 0.15, arcDegrees: 280 },
  adventurous: { radiusFraction: 0.18, arcDegrees: 290 },
};

/** TomTom routeType per personality. */
const TOMTOM_ROUTE_TYPE = {
  fast:        'fastest',
  scenic:      'thrilling',
  curvy:       'thrilling',
  adventurous: 'thrilling',
};

/** Whether to avoid motorways per personality. */
const AVOID_MOTORWAYS = {
  fast:        false,
  scenic:      true,
  curvy:       true,
  adventurous: true,
};

/**
 * Generate waypoints for an AI loop route.
 *
 * @param {{ latitude: number, longitude: number }} origin  – user's current location
 * @param {{
 *   direction: string,         – 'any' | 'north' | 'northeast' | 'east' | 'southeast' |
 *                                'south' | 'southwest' | 'west' | 'northwest'
 *   maxDistanceKm: number,     – target total route distance (approximate)
 *   routePersonality: string,  – 'fast' | 'scenic' | 'curvy' | 'adventurous'
 * }} options
 *
 * @returns {{
 *   waypoints: Array<{ latitude: number, longitude: number, title: string }>,
 *   destination: { latitude: number, longitude: number, title: string },
 *   tomtomRouteType: string,
 *   avoidMotorways: boolean,
 * }}
 */
export function generateAiRouteWaypoints(origin, {
  direction = 'any',
  maxDistanceKm = 50,
  routePersonality = 'scenic',
  strictLoop = false,
  startPoint = null,
  endPoint = null,
  minStartEndSeparationMeters = 120,
} = {}) {
  const normalizedOrigin = normalizeCoord(origin);
  if (!normalizedOrigin) {
    throw new Error('A valid origin coordinate is required');
  }

  const normalizedStart = normalizeCoord(startPoint) || normalizedOrigin;
  const startLabel = startPoint?.title || startPoint?.name || null;
  const endLabel = endPoint?.title || endPoint?.name || null;

  // Resolve bearing
  let primaryBearing = DIRECTION_BEARINGS[direction];
  if (primaryBearing === null) {
    primaryBearing = Math.floor(Math.random() * 360);
  }

  const baseProfile = LOOP_PROFILE_BY_PERSONALITY[routePersonality] ?? LOOP_PROFILE_BY_PERSONALITY.scenic;
  const profile = strictLoop
    ? {
        ...baseProfile,
        radiusFraction: Math.max(baseProfile.radiusFraction, 0.18),
        arcDegrees: Math.min(320, baseProfile.arcDegrees + 35),
      }
    : baseProfile;

  // Pick a stable turning side (left or right) for a single coherent loop.
  const sideSign = Math.random() < 0.5 ? 1 : -1;

  // Build an implicit circle whose edge passes through the start point.
  const loopRadiusKm = Math.max(2.5, maxDistanceKm * profile.radiusFraction);
  const loopCenter = offsetCoordinateKm(normalizedStart, (primaryBearing + sideSign * 90 + 360) % 360, loopRadiusKm);

  // Angle around the loop circle where start sits.
  const startCircleBearing = bearingBetween(loopCenter, normalizedStart);

  // Travel around the same arc direction for all points to avoid geometric cross-overs.
  const waypointCount = strictLoop ? 4 : 3;
  const arcStep = profile.arcDegrees / (waypointCount + 1);
  const waypointBearings = Array.from({ length: waypointCount }, (_, idx) => (
    startCircleBearing + sideSign * arcStep * (idx + 1)
  ));

  const waypoints = waypointBearings.map((bearing, index) => ({
    ...offsetCoordinateKm(loopCenter, (bearing + 360) % 360, loopRadiusKm),
    title: `Loop point ${index + 1}`,
    source: 'ai',
  }));

  // Default end point is near the start but slightly along the loop tangent.
  const defaultEndPoint = offsetCoordinateKm(
    normalizedStart,
    (startCircleBearing + sideSign * 18 + 360) % 360,
    0.18
  );
  let resolvedDestination = normalizeCoord(endPoint) || defaultEndPoint;

  // If start and end are effectively the same, nudge the destination so route solving stays stable.
  if (distanceBetweenMeters(normalizedStart, resolvedDestination) < minStartEndSeparationMeters) {
    const nudgeKm = Math.max(minStartEndSeparationMeters, 75) / 1000;
    resolvedDestination = offsetCoordinateKm(
      normalizedStart,
      (startCircleBearing + sideSign * 22 + 360) % 360,
      nudgeKm
    );
  }

  const destination = {
    ...resolvedDestination,
    title: endPoint ? (endLabel || 'Route end') : 'Return to start',
    source: 'ai',
  };

  return {
    start: {
      ...normalizedStart,
      title: startLabel || 'Route start',
    },
    waypoints,
    destination,
    tomtomRouteType: TOMTOM_ROUTE_TYPE[routePersonality] ?? 'thrilling',
    avoidMotorways: AVOID_MOTORWAYS[routePersonality] ?? true,
  };
}

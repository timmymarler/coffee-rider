import { db } from "@config/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

/**
 * Firestore document size limit: 1MB per document
 * Large polylines (1000+ points) can easily exceed this, causing silent query failures.
 * This module implements progressive polyline simplification to stay well below the limit.
 */

// Simplify polyline using Douglas-Peucker algorithm to reduce size for storage
// tolerance is in meters, higher tolerance = more aggressive simplification
function simplifyPolyline(polyline, tolerance = 10) {
  if (!polyline || polyline.length < 3) return polyline;
  
  // Convert to format expected by simplification algorithm
  const points = polyline.map(p => [p.latitude, p.longitude]);
  
  // Douglas-Peucker simplification
  function dougPeuck(pts, eps) {
    const dmax = { index: 0, dist: 0 };
    
    for (let i = 1; i < pts.length - 1; i++) {
      // Distance from point to line
      const d = pointToLineDistance(pts[i], pts[0], pts[pts.length - 1]);
      if (d > dmax.dist) {
        dmax.dist = d;
        dmax.index = i;
      }
    }
    
    if (dmax.dist > eps) {
      const recRes1 = dougPeuck(pts.slice(0, dmax.index + 1), eps);
      const recRes2 = dougPeuck(pts.slice(dmax.index), eps);
      return [...recRes1.slice(0, -1), ...recRes2];
    } else {
      return [pts[0], pts[pts.length - 1]];
    }
  }
  
  function pointToLineDistance(pt, lineStart, lineEnd) {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    const denom = dx * dx + dy * dy;
    
    if (denom === 0) {
      const dx2 = pt[0] - lineStart[0];
      const dy2 = pt[1] - lineStart[1];
      return Math.sqrt(dx2 * dx2 + dy2 * dy2);
    }
    
    let t = ((pt[0] - lineStart[0]) * dx + (pt[1] - lineStart[1]) * dy) / denom;
    t = Math.max(0, Math.min(1, t));
    
    const projX = lineStart[0] + t * dx;
    const projY = lineStart[1] + t * dy;
    const px = pt[0] - projX;
    const py = pt[1] - projY;
    return Math.sqrt(px * px + py * py);
  }
  
  // Convert tolerance from meters to degrees (rough approximation)
  const toleranceDegrees = tolerance / 111320; // 1 degree ≈ 111320 meters
  const simplified = dougPeuck(points, toleranceDegrees);
  
  // Convert back to original format
  return simplified.map(p => ({
    latitude: p[0],
    longitude: p[1],
  }));
}

export async function saveRide({
  user,
  capabilities,
  name,
  polyline,
  origin,
  destination,
  routeMeta,
  completedAt,
  travelMode,
  waypoints = [],
}) {
  if (!user) throw new Error("User required to save ride");
  if (!capabilities?.canSaveRoutes) {
    throw new Error("Saving rides requires appropriate permissions");
  }

  // Simplify polyline if it's too large to reduce storage size
  // Firestore has a 1MB document limit, and large polylines can exceed this
  let processedPolyline = polyline;
  if (polyline && polyline.length > 300) {
    console.log('[saveRide] Polyline has', polyline.length, 'points, simplifying...');
    
    // Progressive simplification with increasing tolerance
    processedPolyline = simplifyPolyline(polyline, 10); // 10 meter tolerance
    console.log('[saveRide] Pass 1 (10m): simplified to', processedPolyline.length, 'points');
    
    if (processedPolyline.length > 1000) {
      // Still too many points, be more aggressive
      processedPolyline = simplifyPolyline(processedPolyline, 25); // 25 meter tolerance
      console.log('[saveRide] Pass 2 (25m): simplified to', processedPolyline.length, 'points');
    }
    
    if (processedPolyline.length > 1500) {
      // Extremely large ride, very aggressive simplification
      processedPolyline = simplifyPolyline(processedPolyline, 50); // 50 meter tolerance
      console.log('[saveRide] Pass 3 (50m): simplified to', processedPolyline.length, 'points');
    }
    
    // Hard cap at 2000 points to ensure document stays under Firestore limits
    if (processedPolyline.length > 2000) {
      const reduced = [];
      const step = Math.ceil(processedPolyline.length / 2000);
      for (let i = 0; i < processedPolyline.length; i += step) {
        reduced.push(processedPolyline[i]);
      }
      // Ensure we always include the last point
      if (reduced[reduced.length - 1] !== processedPolyline[processedPolyline.length - 1]) {
        reduced.push(processedPolyline[processedPolyline.length - 1]);
      }
      processedPolyline = reduced;
      console.log('[saveRide] Hard cap applied: reduced to', processedPolyline.length, 'points');
    }
  }

  const rideData = {
    // Use routePolyline for unified structure with routes
    routePolyline: processedPolyline,
    // Include origin and destination for marker display when viewing
    origin: origin || null,
    destination: destination || null,
    distanceMeters: routeMeta?.distanceMeters ?? null,
    durationSeconds: routeMeta?.durationSeconds ?? null,
    completedAt: completedAt || serverTimestamp(),
    createdAt: serverTimestamp(),
    // Type identifier: 'ride' for tracked rides, 'route' for planned routes
    type: "ride",
    // Travel mode stored for metadata/analytics
    travelMode: travelMode || null,
    // Store waypoints so they can be displayed when viewing the ride
    waypoints: Array.isArray(waypoints) && waypoints.length > 0 ? waypoints : null,
  };

  // If name is provided, include it
  if (name !== undefined) {
    rideData.name = name || null;
  }

  // Save to 'routes' collection (unified storage for routes and rides)
  const documentData = {
    ownerId: user.uid,
    name: name || null,
    createdBy: user.uid,
    visibility: "private", // Rides are always private by default
    deleted: false,
    ...rideData,
  };
  
  console.log('[saveRide] Saving ride with data:', {
    ownerId: documentData.ownerId,
    name: documentData.name,
    type: documentData.type,
    deleted: documentData.deleted,
    visibility: documentData.visibility,
    routePolylineLength: documentData.routePolyline?.length,
  });
  
  // Validate document size before saving
  const estimatedSize = new Blob([JSON.stringify(documentData)]).size;
  console.log('[saveRide] Estimated document size:', (estimatedSize / 1024).toFixed(2), 'KB');
  
  if (estimatedSize > 900000) { // 900KB warning threshold
    console.warn('[saveRide] ⚠️  Document is large (>', (estimatedSize / 1024 / 1024).toFixed(2), 'MB). Consider simplifying further.');
  }
  
  return addDoc(collection(db, "routes"), documentData);
}

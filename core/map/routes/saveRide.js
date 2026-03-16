import { db } from "@config/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function saveRide({
  user,
  capabilities,
  name,
  polyline,
  routeMeta,
  completedAt,
  travelMode,
}) {
  if (!user) throw new Error("User required to save ride");
  if (!capabilities?.canSaveRoutes) {
    throw new Error("Saving rides requires appropriate permissions");
  }

  const rideData = {
    // Use routePolyline for unified structure with routes
    routePolyline: polyline,
    distanceMeters: routeMeta?.distanceMeters ?? null,
    durationSeconds: routeMeta?.durationSeconds ?? null,
    completedAt: completedAt || serverTimestamp(),
    createdAt: serverTimestamp(),
    // Type identifier: 'ride' for tracked rides, 'route' for planned routes
    type: "ride",
    // Travel mode stored for metadata/analytics
    travelMode: travelMode || null,
  };

  // If name is provided, include it
  if (name !== undefined) {
    rideData.name = name || null;
  }

  // Save to 'routes' collection (unified storage for routes and rides)
  return addDoc(collection(db, "routes"), {
    ownerId: user.uid,
    name: name || null,
    createdBy: user.uid,
    visibility: "private", // Rides are always private by default
    deleted: false,
    ...rideData,
  });
}

import { db } from "@config/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function saveRide({
  user,
  capabilities,
  name,
  polyline,
  routeMeta,
  completedAt,
}) {
  if (!user) throw new Error("User required to save ride");
  if (!capabilities?.canSaveRoutes) {
    throw new Error("Saving rides requires appropriate permissions");
  }

  const rideData = {
    ridePolyline: polyline,
    distanceMeters: routeMeta?.distanceMeters ?? null,
    durationSeconds: routeMeta?.durationSeconds ?? null,
    completedAt: completedAt || serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  // If name is provided, include it
  if (name !== undefined) {
    rideData.name = name || null;
  }

  // Create new ride
  return addDoc(collection(db, "rides"), {
    ownerId: user.uid,
    name: name || null,
    createdBy: user.uid,
    ...rideData,
  });
}

import { db } from "@config/firebase";
import { addDoc, collection, serverTimestamp, doc, updateDoc } from "firebase/firestore";

export async function saveRoute({
  user,
  visibility = "private",
  name,
  origin,
  destination,
  waypoints,
  routeMeta,
  polyline,
  routeId, // if provided, will update instead of create
}) {
  if (!user) throw new Error("User required to save route");

  const routeData = {
    origin,
    destination,
    waypoints,
    routePolyline: polyline,
    distanceMeters: routeMeta?.distanceMeters ?? null,
    durationSeconds: routeMeta?.durationSeconds ?? null,
    updatedAt: serverTimestamp(),
  };

  // If name is provided, include it (for new routes or when creating new from existing)
  if (name !== undefined) {
    routeData.name = name || null;
  }

  if (routeId) {
    // Update existing route
    const routeRef = doc(db, "routes", routeId);
    await updateDoc(routeRef, routeData);
    return { id: routeId };
  } else {
    // Create new route
    return addDoc(collection(db, "routes"), {
      ownerId: user.uid,
      visibility,
      name: name || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      ...routeData,
    });
  }
}

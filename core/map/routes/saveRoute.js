import { db } from "@config/firebase";
import { trackUsageEventSafe } from "@core/utils/usageTelemetry";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";

export async function saveRoute({
  user,
  capabilities,
  visibility = "private",
  name,
  origin,
  destination,
  waypoints,
  routeMeta,
  polyline,
  routeId, // if provided, will update instead of create
  tomtomSteps,
  tomtomGuidance,
  tomtomRawRoute,
}) {
  if (!user) throw new Error("User required to save route");
  if (!capabilities?.canSaveRoutes) {
    throw new Error("Saving routes requires appropriate permissions");
  }

  const routeData = {
    origin,
    destination,
    waypoints,
    routePolyline: polyline,
    distanceMeters: routeMeta?.distanceMeters ?? null,
    durationSeconds: routeMeta?.durationSeconds ?? null,
    updatedAt: serverTimestamp(),
    // Type identifier: 'route' for planned routes, 'ride' for tracked rides
    type: "route",
    // Debug fields for TomTom
    tomtomSteps: tomtomSteps ?? null,
    tomtomGuidance: tomtomGuidance ?? null,
    tomtomRawRoute: tomtomRawRoute ?? null,
  };

  // If name is provided, include it (for new routes or when creating new from existing)
  if (name !== undefined) {
    routeData.name = name || null;
  }

  if (routeId) {
    // Update existing route
    const routeRef = doc(db, "routes", routeId);
    await updateDoc(routeRef, routeData);
    trackUsageEventSafe("route", "route_updated", {
      cooldownMs: 500,
      meta: { hasName: Boolean(name) },
    });
    return { id: routeId };
  } else {
    // Create new route
    const created = await addDoc(collection(db, "routes"), {
      ownerId: user.uid,
      visibility,
      name: name || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      deleted: false,
      ...routeData,
    });
    trackUsageEventSafe("route", "route_saved", {
      cooldownMs: 500,
      meta: { visibility: visibility || "private" },
    });
    return created;
  }
}

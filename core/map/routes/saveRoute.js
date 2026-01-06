import { db } from "@config/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function saveRoute({
  user,
  visibility = "private",
  origin,
  destination,
  waypoints,
  routeMeta,
  polyline,
}) {
  if (!user) throw new Error("User required to save route");

  return addDoc(collection(db, "routes"), {
    ownerId: user.uid,
    visibility,

    origin,
    destination,

    waypoints,

    routePolyline: polyline,
    distanceMeters: routeMeta?.distanceMeters ?? null,
    durationSeconds: routeMeta?.durationSeconds ?? null,

    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    visibility: "private" | "group" | "public",
  });
}

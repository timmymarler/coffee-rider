import { db } from "@/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function saveRoute({
  user,
  title,
  destination,
  waypoints,
  routeMeta,
}) {
  console.log("Saving route");
  if (!user || !destination) return;
  console.log("User",user,"Destination",destination);

  return addDoc(collection(db, "routes"), {
    title,
    createdBy: user.uid,
    createdAt: serverTimestamp(),

    destination: {
      lat: destination.latitude,
      lng: destination.longitude,
      title: destination.title,
      placeId: destination.id,
    },

    waypoints: waypoints.map(wp => ({
      lat: wp.lat,
      lng: wp.lng,
      title: wp.title,
      source: wp.source,
    })),

    distanceMeters: routeMeta.distanceMeters,
    durationSeconds: routeMeta.durationSeconds,
  });
}

import { db } from "@config/firebase";
import { deleteDoc, doc } from "firebase/firestore";

export async function deleteRide(rideId, source = "new") {
  if (!rideId) {
    throw new Error("Ride ID required");
  }

  const collectionName = source === "old" ? "rides" : "routes";

  try {
    await deleteDoc(doc(db, collectionName, rideId));
    console.log("[deleteRide] Ride deleted:", rideId, "source:", source);
  } catch (error) {
    console.error("[deleteRide] Failed to delete ride:", error);

    if (error.code === "permission-denied") {
      throw new Error("You don't have permission to delete this ride");
    }

    if (error.code === "not-found") {
      throw new Error("Ride not found");
    }

    throw new Error("Failed to delete ride: " + error.message);
  }
}

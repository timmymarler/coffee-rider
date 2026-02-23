import { db } from "@config/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

/**
 * Soft-delete a route (marks deleted but keeps data for 30-day recovery window)
 * 
 * Only the creator or an admin can delete a route
 * 
 * @param {String} routeId - Route document ID
 * @param {String} userId - Current user ID (for permission check)
 * @param {Boolean} isAdmin - Whether user is admin
 * @throws {Error} If user lacks permission or routeId is invalid
 * @returns {Promise<void>}
 */
export async function deleteRoute(routeId, userId, isAdmin = false) {
  if (!routeId) {
    throw new Error("Route ID required");
  }

  if (!userId) {
    throw new Error("User ID required");
  }

  // Note: Firestore security rules will also enforce this, but check client-side too
  // Permission check would require reading the document first
  // Instead we rely on Firestore rules to enforce owner/admin check

  try {
    const routeRef = doc(db, "routes", routeId);
    
    await updateDoc(routeRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    console.log("[deleteRoute] Route soft-deleted:", routeId);
  } catch (error) {
    console.error("[deleteRoute] Failed to delete route:", error);
    
    if (error.code === 'permission-denied') {
      throw new Error("You don't have permission to delete this route");
    }
    
    if (error.code === 'not-found') {
      throw new Error("Route not found");
    }

    throw new Error(`Failed to delete route: ${error.message}`);
  }
}

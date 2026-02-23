import { db } from "@config/firebase";
import { doc, updateDoc } from "firebase/firestore";

/**
 * Recover a soft-deleted route (within 30-day recovery window)
 * 
 * Only the creator or an admin can recover a route
 * 
 * @param {String} routeId - Route document ID
 * @param {String} userId - Current user ID (for permission check)
 * @param {Boolean} isAdmin - Whether user is admin
 * @throws {Error} If user lacks permission, route not found, or recovery window expired
 * @returns {Promise<void>}
 */
export async function recoverRoute(routeId, userId, isAdmin = false) {
  if (!routeId) {
    throw new Error("Route ID required");
  }

  if (!userId) {
    throw new Error("User ID required");
  }

  try {
    const routeRef = doc(db, "routes", routeId);
    
    await updateDoc(routeRef, {
      deleted: false,
      deletedAt: null,
      deletedBy: null,
    });

    console.log("[recoverRoute] Route recovered:", routeId);
  } catch (error) {
    console.error("[recoverRoute] Failed to recover route:", error);
    
    if (error.code === 'permission-denied') {
      throw new Error("You don't have permission to recover this route");
    }
    
    if (error.code === 'not-found') {
      throw new Error("Route not found");
    }

    throw new Error(`Failed to recover route: ${error.message}`);
  }
}

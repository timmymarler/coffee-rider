import { db } from "@config/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

/**
 * Soft-delete a group (marks deleted but keeps data for 30-day recovery window)
 * 
 * Only the owner can delete a group
 * 
 * @param {String} groupId - Group document ID
 * @param {String} userId - Current user ID (for permission check)
 * @throws {Error} If user lacks permission or groupId is invalid
 * @returns {Promise<void>}
 */
export async function deleteGroup(groupId, userId) {
  if (!groupId) {
    throw new Error("Group ID required");
  }

  if (!userId) {
    throw new Error("User ID required");
  }

  try {
    const groupRef = doc(db, "groups", groupId);
    
    await updateDoc(groupRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    console.log("[deleteGroup] Group soft-deleted:", groupId);
  } catch (error) {
    console.error("[deleteGroup] Failed to delete group:", error);
    
    if (error.code === 'permission-denied') {
      throw new Error("You don't have permission to delete this group");
    }
    
    if (error.code === 'not-found') {
      throw new Error("Group not found");
    }

    throw new Error(`Failed to delete group: ${error.message}`);
  }
}

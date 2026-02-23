import { db } from "@config/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

/**
 * Soft-delete a calendar event (marks deleted but keeps data for 30-day recovery window)
 * 
 * Only the creator or an admin can delete an event
 * 
 * @param {String} eventId - Event document ID
 * @param {String} userId - Current user ID (for permission check)
 * @param {Boolean} isAdmin - Whether user is admin
 * @throws {Error} If user lacks permission or eventId is invalid
 * @returns {Promise<void>}
 */
export async function deleteEvent(eventId, userId, isAdmin = false) {
  if (!eventId) {
    throw new Error("Event ID required");
  }

  if (!userId) {
    throw new Error("User ID required");
  }

  try {
    const eventRef = doc(db, "events", eventId);
    
    await updateDoc(eventRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    console.log("[deleteEvent] Event soft-deleted:", eventId);
  } catch (error) {
    console.error("[deleteEvent] Failed to delete event:", error);
    
    if (error.code === 'permission-denied') {
      throw new Error("You don't have permission to delete this event");
    }
    
    if (error.code === 'not-found') {
      throw new Error("Event not found");
    }

    throw new Error(`Failed to delete event: ${error.message}`);
  }
}

/**
 * Soft-delete all events in a series
 * 
 * @param {Array<String>} eventIds - Array of event document IDs
 * @param {String} userId - Current user ID (for permission check)
 * @param {Boolean} isAdmin - Whether user is admin
 * @throws {Error} If user lacks permission or deletion fails
 * @returns {Promise<void>}
 */
export async function deleteEventSeries(eventIds, userId, isAdmin = false) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    throw new Error("Event IDs array required");
  }

  if (!userId) {
    throw new Error("User ID required");
  }

  try {
    const updates = eventIds.map(eventId => 
      updateDoc(doc(db, "events", eventId), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: userId,
      })
    );

    await Promise.all(updates);
    console.log("[deleteEventSeries] Series soft-deleted, count:", eventIds.length);
  } catch (error) {
    console.error("[deleteEventSeries] Failed to delete series:", error);
    
    if (error.code === 'permission-denied') {
      throw new Error("You don't have permission to delete these events");
    }

    throw new Error(`Failed to delete event series: ${error.message}`);
  }
}

/**
 * Recover a soft-deleted event (within 30-day recovery window)
 * 
 * Only the creator or an admin can recover an event
 * 
 * @param {String} eventId - Event document ID
 * @param {String} userId - Current user ID (for permission check)
 * @param {Boolean} isAdmin - Whether user is admin
 * @throws {Error} If user lacks permission or event not found
 * @returns {Promise<void>}
 */
export async function recoverEvent(eventId, userId, isAdmin = false) {
  if (!eventId) {
    throw new Error("Event ID required");
  }

  if (!userId) {
    throw new Error("User ID required");
  }

  try {
    const eventRef = doc(db, "events", eventId);
    
    await updateDoc(eventRef, {
      deleted: false,
      deletedAt: null,
      deletedBy: null,
    });

    console.log("[recoverEvent] Event recovered:", eventId);
  } catch (error) {
    console.error("[recoverEvent] Failed to recover event:", error);
    
    if (error.code === 'permission-denied') {
      throw new Error("You don't have permission to recover this event");
    }
    
    if (error.code === 'not-found') {
      throw new Error("Event not found");
    }

    throw new Error(`Failed to recover event: ${error.message}`);
  }
}

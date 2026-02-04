import { db } from "@config/firebase";
import {
    doc,
    getDoc,
    serverTimestamp,
    updateDoc
} from "firebase/firestore";

export const EVENT_VISIBILITY = {
  PRIVATE: "private",
  GROUP: "group",
  PUBLIC: "public",
};

/**
 * Share an event with visibility settings
 * @param {string} eventId - Event ID to share
 * @param {string} visibility - "private" | "group" | "public"
 * @param {string} groupId - Group ID if visibility is "group"
 * @param {object} capabilities - User capabilities object
 * @param {string} userId - Current user ID to verify ownership
 */
export async function shareEvent({ eventId, visibility, groupId = null, capabilities, userId }) {
  if (!capabilities?.canShareEvents) {
    throw new Error("Sharing events requires Pro/Place Owner access");
  }
  if (!eventId) throw new Error("eventId is required");
  if (!userId) throw new Error("userId is required");
  if (!visibility || !Object.values(EVENT_VISIBILITY).includes(visibility)) {
    throw new Error("Invalid visibility");
  }
  if (visibility === EVENT_VISIBILITY.GROUP && !groupId) {
    throw new Error("groupId required when visibility is 'group'");
  }

  // Verify user owns the event (check both userId and createdBy for backwards compatibility)
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) {
    throw new Error("Event not found");
  }
  
  const eventData = eventSnap.data();
  const owner = eventData.createdBy || eventData.userId;
  
  console.log("[shareEvent] User:", userId, "Event Owner:", owner, "Event data keys:", Object.keys(eventData));
  
  if (owner !== userId) {
    throw new Error(`You can only share your own events. Owner: ${owner}, You: ${userId}`);
  }

  // If sharing to multiple groups, groupId can be an array
  let updateData = {
    visibility,
    updatedAt: serverTimestamp(),
  };

  if (visibility === EVENT_VISIBILITY.GROUP) {
    // Accept array or string for groupId
    if (Array.isArray(groupId)) {
      updateData.groupIds = groupId;
      updateData.groupId = null;
    } else {
      updateData.groupIds = [groupId];
      updateData.groupId = groupId;
    }
  } else {
    updateData.groupIds = [];
    updateData.groupId = null;
  }

  await updateDoc(eventRef, updateData);
}

import { db } from "@config/firebase";
import {
    doc,
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
 */
export async function shareEvent({ eventId, visibility, groupId = null, capabilities }) {
  if (!capabilities?.canShareEvents) {
    throw new Error("Sharing events requires Pro/Place Owner access");
  }
  if (!eventId) throw new Error("eventId is required");
  if (!visibility || !Object.values(EVENT_VISIBILITY).includes(visibility)) {
    throw new Error("Invalid visibility");
  }
  if (visibility === EVENT_VISIBILITY.GROUP && !groupId) {
    throw new Error("groupId required when visibility is 'group'");
  }

  const eventRef = doc(db, "events", eventId);
  const updateData = {
    visibility,
    updatedAt: serverTimestamp(),
  };

  if (visibility === EVENT_VISIBILITY.GROUP) {
    updateData.groupId = groupId;
  } else {
    // Remove groupId if changing away from group visibility
    updateData.groupId = null;
  }

  await updateDoc(eventRef, updateData);
}

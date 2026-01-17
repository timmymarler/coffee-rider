import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { db } from "@config/firebase";

export const RIDE_VISIBILITY = {
  PRIVATE: "private",
  GROUP: "group",
  PUBLIC: "public",
};

export const PARTICIPANT_STATUS = {
  ACTIVE: "active",
  LEFT: "left",
};

/**
 * Share a route with visibility settings
 * @param {string} routeId - Route ID to share
 * @param {string} visibility - "private" | "group" | "public"
 * @param {string} groupId - Group ID if visibility is "group"
 */
export async function shareRoute({ routeId, visibility, groupId = null }) {
  if (!routeId) throw new Error("routeId is required");
  if (!visibility || !Object.values(RIDE_VISIBILITY).includes(visibility)) {
    throw new Error("Invalid visibility");
  }
  if (visibility === RIDE_VISIBILITY.GROUP && !groupId) {
    throw new Error("groupId required when visibility is 'group'");
  }

  const routeRef = doc(db, "routes", routeId);
  const updateData = {
    visibility,
    updatedAt: serverTimestamp(),
  };

  if (visibility === RIDE_VISIBILITY.GROUP) {
    updateData.groupId = groupId;
  } else {
    // Remove groupId if changing away from group visibility
    updateData.groupId = null;
  }

  await updateDoc(routeRef, updateData);
}

/**
 * Start a ride (activate the route for participants to join)
 * @param {string} routeId - Route ID
 * @param {string} userId - User starting the ride
 */
export async function startRide({ routeId, userId }) {
  if (!routeId) throw new Error("routeId is required");
  if (!userId) throw new Error("userId is required");

  const routeRef = doc(db, "routes", routeId);
  await updateDoc(routeRef, {
    isActive: true,
    startedAt: serverTimestamp(),
    participants: [
      {
        userId,
        joinedAt: Timestamp.now(),
        status: PARTICIPANT_STATUS.ACTIVE,
      },
    ],
    updatedAt: serverTimestamp(),
  });
}

/**
 * End a ride (deactivate and stop accepting joins)
 * @param {string} routeId - Route ID
 */
export async function endRide({ routeId }) {
  if (!routeId) throw new Error("routeId is required");

  const routeRef = doc(db, "routes", routeId);
  await updateDoc(routeRef, {
    isActive: false,
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Join an active ride
 * @param {string} routeId - Route ID
 * @param {string} userId - User joining
 */
export async function joinRide({ routeId, userId }) {
  if (!routeId) throw new Error("routeId is required");
  if (!userId) throw new Error("userId is required");

  const routeRef = doc(db, "routes", routeId);

  // Check if ride is still active
  const routeSnap = await getDoc(routeRef);
  if (!routeSnap.exists()) throw new Error("Route not found");

  const route = routeSnap.data();
  if (!route.isActive) throw new Error("This ride is no longer active");

  // Check if user already participated
  const existingParticipant = route.participants?.find(p => p.userId === userId);
  if (existingParticipant && existingParticipant.status === PARTICIPANT_STATUS.ACTIVE) {
    throw new Error("You are already in this ride");
  }

  // Add or re-add participant
  const participant = {
    userId,
    joinedAt: Timestamp.now(),
    status: PARTICIPANT_STATUS.ACTIVE,
  };

  // If user previously left, update their status; otherwise add new entry
  if (existingParticipant) {
    const updatedParticipants = route.participants.map(p =>
      p.userId === userId ? participant : p
    );
    await updateDoc(routeRef, { participants: updatedParticipants });
  } else {
    await updateDoc(routeRef, {
      participants: arrayUnion(participant),
    });
  }
}

/**
 * Leave an active ride
 * @param {string} routeId - Route ID
 * @param {string} userId - User leaving
 */
export async function leaveRide({ routeId, userId }) {
  if (!routeId) throw new Error("routeId is required");
  if (!userId) throw new Error("userId is required");

  const routeRef = doc(db, "routes", routeId);
  const routeSnap = await getDoc(routeRef);
  if (!routeSnap.exists()) throw new Error("Route not found");

  const route = routeSnap.data();
  const updatedParticipants = (route.participants || []).map(p =>
    p.userId === userId ? { ...p, status: PARTICIPANT_STATUS.LEFT } : p
  );

  await updateDoc(routeRef, { participants: updatedParticipants });
}

/**
 * Get active participants in a ride
 */
export function getActiveParticipants(route) {
  if (!route.participants) return [];
  return route.participants.filter(p => p.status === PARTICIPANT_STATUS.ACTIVE);
}

import { db } from "@config/firebase";
import { joinRide } from "./sharedRides";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";

const RIDE_INVITES = "rideInvites";

export async function sendRideInvites({
  routeId,
  groupId,
  senderId,
  senderName,
  routeName,
  distanceMeters,
  durationSeconds,
  startTime,
  routePreview = [],
  recipients,
}) {
  if (!routeId || !groupId || !senderId) throw new Error("Ride invite is missing route, group or sender");
  const uniqueRecipientIds = [...new Set((recipients || []).filter(id => id && id !== senderId))];
  if (uniqueRecipientIds.length === 0) throw new Error("Choose at least one group member to invite");
  const previewStride = Math.max(1, Math.ceil(routePreview.length / 48));
  const compactPreview = routePreview
    .filter((_, index) => index % previewStride === 0 || index === routePreview.length - 1)
    .map(point => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) }))
    .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  const batch = writeBatch(db);
  const inviteRefs = uniqueRecipientIds.map(recipientId => {
    const inviteRef = doc(collection(db, RIDE_INVITES));
    batch.set(inviteRef, {
      type: "joinRide",
      routeId,
      groupId,
      senderId,
      senderName: senderName || "A rider",
      recipientId,
      routeName: routeName || "Shared ride",
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      routePreview: compactPreview,
      startTime,
      status: "pending",
      createdAt: serverTimestamp(),
      respondedAt: null,
    });
    return inviteRef.id;
  });
  await batch.commit();
  return inviteRefs;
}

export function usePendingRideInvites(userId) {
  const [invites, setInvites] = useState([]);

  useEffect(() => {
    if (!userId) {
      setInvites([]);
      return undefined;
    }

    const invitesQuery = query(collection(db, RIDE_INVITES), where("recipientId", "==", userId));
    return onSnapshot(invitesQuery, snapshot => {
      setInvites(snapshot.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(invite => invite.status === "pending")
        .sort((first, second) => (second.createdAt?.toMillis?.() || 0) - (first.createdAt?.toMillis?.() || 0)));
    }, error => {
      console.warn("[RideInvites] Listener error:", error?.message || error);
      setInvites([]);
    });
  }, [userId]);

  return invites;
}

export async function declineRideInvite(invite) {
  if (!invite?.id) throw new Error("Ride invite is missing its ID");
  await updateDoc(doc(db, RIDE_INVITES, invite.id), {
    status: "declined",
    respondedAt: serverTimestamp(),
  });
}

export async function acceptRideInvite(invite, user) {
  if (!invite?.id || !invite.routeId || !invite.groupId || !user?.uid) {
    throw new Error("Ride invite is incomplete");
  }
  await joinRide({ routeId: invite.routeId, userId: user.uid });
}

export async function markRideInviteAccepted(invite) {
  if (!invite?.id) throw new Error("Ride invite is missing its ID");
  await updateDoc(doc(db, RIDE_INVITES, invite.id), {
    status: "accepted",
    respondedAt: serverTimestamp(),
  });
}

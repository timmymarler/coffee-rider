import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { findUserByContactEmail } from "@firebaseLocal/users";
import {
    computeInviteExpiry,
    GROUP_INVITE_EXPIRY_DAYS,
    GROUP_INVITE_STATUS,
    GROUP_INVITES_COLLECTION,
    GROUP_MEMBER_ROLE,
    GROUP_MEMBERS_SUBCOLLECTION,
    GROUP_STATUS,
    GROUPS_COLLECTION,
} from "./constants";

function assertGroupsAccess(capabilities) {
  if (!capabilities?.canAccessGroups) {
    throw new Error("Groups feature requires Pro or Admin access");
  }
}

export async function createGroup({ name, userId, capabilities }) {
  assertGroupsAccess(capabilities);
  if (!userId) throw new Error("userId is required");

  const groupsCol = collection(db, GROUPS_COLLECTION);
  const groupRef = doc(groupsCol);
  const now = serverTimestamp();

  await setDoc(groupRef, {
    name: name || "Untitled Group",
    ownerId: userId,
    status: GROUP_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  const memberRef = doc(db, GROUPS_COLLECTION, groupRef.id, GROUP_MEMBERS_SUBCOLLECTION, userId);
  await setDoc(memberRef, {
    uid: userId,
    role: GROUP_MEMBER_ROLE.OWNER,
    joinedAt: now,
    addedBy: userId,
    status: "active",
  });

  return groupRef.id;
}

export async function sendInvite({
  groupId,
  inviteeUid,
  inviteeEmail,
  role = GROUP_MEMBER_ROLE.MEMBER,
  inviterId,
  capabilities,
  expiryDays = GROUP_INVITE_EXPIRY_DAYS,
}) {
  assertGroupsAccess(capabilities);
  if (!groupId) throw new Error("groupId is required");
  if (!inviterId) throw new Error("inviterId is required");
  if (!inviteeUid && !inviteeEmail) throw new Error("inviteeUid or contactEmail is required");

  // Verify inviter is the group owner
  const groupRef = doc(db, GROUPS_COLLECTION, groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error("Group not found");
  if (groupSnap.data().ownerId !== inviterId) {
    throw new Error("Only the group owner can send invites");
  }

  // If email provided, look up user by contactEmail to get UID
  let finalUid = inviteeUid;
  if (inviteeEmail && !inviteeUid) {
    const foundUser = await findUserByContactEmail(inviteeEmail);
    if (!foundUser) {
      throw new Error(`No user found with email: ${inviteeEmail}`);
    }
    finalUid = foundUser.uid;
  }

  const expiresAt = Timestamp.fromDate(computeInviteExpiry(expiryDays));

  return addDoc(collection(db, GROUP_INVITES_COLLECTION), {
    groupId,
    inviterId,
    inviteeUid: finalUid || null,
    inviteeEmail: inviteeEmail || null,
    role,
    status: GROUP_INVITE_STATUS.PENDING,
    createdAt: serverTimestamp(),
    expiresAt,
  });
}

export async function acceptInvite({ inviteId, userId }) {
  if (!inviteId) throw new Error("inviteId is required");
  if (!userId) throw new Error("userId is required");

  const inviteRef = doc(db, GROUP_INVITES_COLLECTION, inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error("Invite not found");

  const invite = snap.data();
  const now = new Date();

  if (invite.status !== GROUP_INVITE_STATUS.PENDING) {
    throw new Error(`Invite is ${invite.status}`);
  }

  if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < now) {
    await updateDoc(inviteRef, {
      status: GROUP_INVITE_STATUS.EXPIRED,
      expiredAt: serverTimestamp(),
    });
    throw new Error("Invite expired");
  }

  if (invite.inviteeUid && invite.inviteeUid !== userId) {
    throw new Error("Invite does not belong to this user");
  }

  const memberRef = doc(db, GROUPS_COLLECTION, invite.groupId, GROUP_MEMBERS_SUBCOLLECTION, userId);
  await setDoc(memberRef, {
    uid: userId,
    role: invite.role || GROUP_MEMBER_ROLE.MEMBER,
    joinedAt: serverTimestamp(),
    addedBy: invite.inviterId || null,
    status: "active",
  });

  await updateDoc(inviteRef, {
    status: GROUP_INVITE_STATUS.ACCEPTED,
    acceptedAt: serverTimestamp(),
    inviteeUid: invite.inviteeUid || userId,
  });

  // Small delay to allow Firestore listener to process the status change
  // and remove the accepted invite from the pending list
  await new Promise(resolve => setTimeout(resolve, 100));

  return { groupId: invite.groupId };
}

export async function declineInvite({ inviteId, userId }) {
  if (!inviteId) throw new Error("inviteId is required");
  if (!userId) throw new Error("userId is required");

  const inviteRef = doc(db, GROUP_INVITES_COLLECTION, inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error("Invite not found");

  const invite = snap.data();
  if (invite.inviteeUid && invite.inviteeUid !== userId) {
    throw new Error("Invite does not belong to this user");
  }

  await updateDoc(inviteRef, {
    status: GROUP_INVITE_STATUS.DECLINED,
    declinedAt: serverTimestamp(),
  });
}

export async function revokeInvite({ inviteId, capabilities }) {
  assertGroupsAccess(capabilities);
  if (!inviteId) throw new Error("inviteId is required");

  const inviteRef = doc(db, GROUP_INVITES_COLLECTION, inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error("Invite not found");

  await updateDoc(inviteRef, {
    status: GROUP_INVITE_STATUS.REVOKED,
    revokedAt: serverTimestamp(),
  });
}

/**
 * Leave a group - removes the current user from the group members
 */
export async function leaveGroup({ groupId, userId }) {
  if (!groupId) throw new Error("groupId is required");
  if (!userId) throw new Error("userId is required");

  // Check if user is the owner - owners cannot leave (must delete or transfer ownership)
  const memberRef = doc(db, GROUPS_COLLECTION, groupId, GROUP_MEMBERS_SUBCOLLECTION, userId);
  const memberSnap = await getDoc(memberRef);
  
  if (!memberSnap.exists()) {
    throw new Error("User is not a member of this group");
  }

  const memberData = memberSnap.data();
  if (memberData.role === GROUP_MEMBER_ROLE.OWNER) {
    throw new Error("Group owners cannot leave. Delete the group or transfer ownership first.");
  }

  // Remove user from members
  await deleteDoc(memberRef);
}

/**
 * Remove a member from a group - owner only
 */
export async function removeGroupMember({ groupId, memberId, userId, capabilities }) {
  assertGroupsAccess(capabilities);
  if (!groupId) throw new Error("groupId is required");
  if (!memberId) throw new Error("memberId is required");
  if (!userId) throw new Error("userId is required");

  // Verify requester is the group owner
  const groupRef = doc(db, GROUPS_COLLECTION, groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error("Group not found");
  if (groupSnap.data().ownerId !== userId) {
    throw new Error("Only the group owner can remove members");
  }

  // Prevent removing the owner
  if (memberId === groupSnap.data().ownerId) {
    throw new Error("Cannot remove the group owner");
  }

  // Remove member
  const memberRef = doc(db, GROUPS_COLLECTION, groupId, GROUP_MEMBERS_SUBCOLLECTION, memberId);
  await deleteDoc(memberRef);
}

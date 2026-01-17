import { db } from "@config/firebase";
import { collection, collectionGroup, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { GROUP_INVITE_STATUS, GROUP_INVITES_COLLECTION, GROUP_MEMBERS_SUBCOLLECTION, GROUPS_COLLECTION } from "./constants";

export function usePendingInvites(userId, userEmail) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId && !userEmail) {
      setInvites([]);
      setLoading(false);
      return undefined;
    }

    const unsubscribes = [];
    const invitesMap = new Map();

    const updateInvites = () => {
      setInvites(Array.from(invitesMap.values()));
      setLoading(false);
    };

    // Query by UID if available
    if (userId) {
      const qUid = query(
        collection(db, GROUP_INVITES_COLLECTION),
        where("inviteeUid", "==", userId),
        where("status", "==", GROUP_INVITE_STATUS.PENDING)
      );

      const unsubUid = onSnapshot(
        qUid,
        (snap) => {
          snap.docs.forEach((d) => invitesMap.set(d.id, { id: d.id, ...d.data() }));
          updateInvites();
          setError(null);
        },
        (err) => {
          console.warn("[usePendingInvites] UID query error:", err.message);
          if (err.code === "failed-precondition") {
            setError("Index building... try again in a moment");
          } else {
            setError(err.message);
          }
          setLoading(false);
        }
      );
      unsubscribes.push(unsubUid);
    }

    // Query by email if available
    if (userEmail) {
      const qEmail = query(
        collection(db, GROUP_INVITES_COLLECTION),
        where("inviteeEmail", "==", userEmail),
        where("status", "==", GROUP_INVITE_STATUS.PENDING)
      );

      const unsubEmail = onSnapshot(
        qEmail,
        (snap) => {
          snap.docs.forEach((d) => invitesMap.set(d.id, { id: d.id, ...d.data() }));
          updateInvites();
          setError(null);
        },
        (err) => {
          console.warn("[usePendingInvites] Email query error:", err.message);
          if (err.code === "failed-precondition") {
            setError("Index building... try again in a moment");
          } else {
            setError(err.message);
          }
          setLoading(false);
        }
      );
      unsubscribes.push(unsubEmail);
    }

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [userId, userEmail]);

  return { invites, loading, error };
}

export function useUserGroups(userId) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }

    // Query groups where user is the owner
    const q = query(
      collection(db, GROUPS_COLLECTION),
      where("ownerId", "==", userId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn("[useUserGroups] Error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [userId]);

  return { groups, loading, error };
}

export function useAllUserGroups(userId) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }

    // Find all member docs where this user participates, then fetch the parent group docs
    const q = query(collectionGroup(db, GROUP_MEMBERS_SUBCOLLECTION), where("uid", "==", userId));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const groupIds = snap.docs.map((d) => d.ref.parent.parent.id);
          const unique = Array.from(new Set(groupIds));
          const promises = unique.map(async (gid) => {
            const g = await getDoc(doc(db, GROUPS_COLLECTION, gid));
            return g.exists() ? { id: gid, ...g.data() } : null;
          });
          const rows = (await Promise.all(promises)).filter(Boolean);
          setGroups(rows);
          setError(null);
          setLoading(false);
        } catch (err) {
          console.warn("[useAllUserGroups] Error:", err.message);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.warn("[useAllUserGroups] Listener Error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [userId]);

  return { groups, loading, error };
}

export function useGroupMembers(groupId) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      setLoading(false);
      return undefined;
    }

    const membersCol = collection(db, GROUPS_COLLECTION, groupId, GROUP_MEMBERS_SUBCOLLECTION);
    const q = query(membersCol);

    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          const profilePromises = rows.map(async (m) => {
            const userRef = doc(db, "users", m.id);
            const userSnap = await getDoc(userRef);
            const profile = userSnap.exists() ? userSnap.data() : {};
            return {
              uid: m.id,
              role: m.role,
              joinedAt: m.joinedAt,
              addedBy: m.addedBy,
              status: m.status,
              displayName: profile.displayName || profile.name || null,
              email: profile.email || null,
              photoURL: profile.photoURL || null,
            };
          });

          const enriched = await Promise.all(profilePromises);
          setMembers(enriched);
          setError(null);
          setLoading(false);
        } catch (err) {
          console.warn("[useGroupMembers] Error:", err.message);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.warn("[useGroupMembers] Listener Error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [groupId]);

  return { members, loading, error };
}

export function useInvitesEnriched(userId, userEmail) {
  const { invites, loading, error } = usePendingInvites(userId, userEmail);
  const [enriched, setEnriched] = useState([]);
  const [enrichedLoading, setEnrichedLoading] = useState(true);

  useEffect(() => {
    if (!loading && invites.length > 0) {
      const enrichPromises = invites.map(async (invite) => {
        try {
          // Fetch group name
          const groupRef = doc(db, GROUPS_COLLECTION, invite.groupId);
          const groupSnap = await getDoc(groupRef);
          const groupName = groupSnap.exists() ? groupSnap.data().name : invite.groupId;

          // Fetch inviter name
          const inviterRef = doc(db, "users", invite.inviterId);
          const inviterSnap = await getDoc(inviterRef);
          const inviterName = inviterSnap.exists() 
            ? (inviterSnap.data().displayName || inviterSnap.data().name || invite.inviterId)
            : invite.inviterId;

          return {
            ...invite,
            groupName,
            inviterName,
          };
        } catch (err) {
          console.warn("[useInvitesEnriched] Error enriching invite:", err.message);
          return invite;
        }
      });

      Promise.all(enrichPromises).then(setEnriched).then(() => setEnrichedLoading(false));
    } else {
      setEnriched([]);
      setEnrichedLoading(loading);
    }
  }, [invites, loading]);

  return { invites: enriched, loading: enrichedLoading, error };
}

export function useSentInvites(userId) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setInvites([]);
      setLoading(false);
      return undefined;
    }

    const q = query(
      collection(db, GROUP_INVITES_COLLECTION),
      where("inviterId", "==", userId),
      where("status", "==", GROUP_INVITE_STATUS.PENDING)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInvites(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn("[useSentInvites] Error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { invites, loading, error };
}

export function useSentInvitesEnriched(userId) {
  const { invites, loading, error } = useSentInvites(userId);
  const [enriched, setEnriched] = useState([]);
  const [enrichedLoading, setEnrichedLoading] = useState(true);

  useEffect(() => {
    if (!loading && invites.length > 0) {
      setEnrichedLoading(true);
      const enrichPromises = invites.map(async (invite) => {
        try {
          // Fetch group name
          const groupRef = doc(db, GROUPS_COLLECTION, invite.groupId);
          const groupSnap = await getDoc(groupRef);
          const groupName = groupSnap.exists() ? groupSnap.data().name : invite.groupId;

          // Fetch invitee name if UID is available
          let inviteeName = invite.inviteeEmail || invite.inviteeUid;
          if (invite.inviteeUid) {
            const inviteeRef = doc(db, "users", invite.inviteeUid);
            const inviteeSnap = await getDoc(inviteeRef);
            if (inviteeSnap.exists()) {
              inviteeName = inviteeSnap.data().displayName || inviteeSnap.data().name || invite.inviteeEmail || invite.inviteeUid;
            }
          }

          return {
            ...invite,
            groupName,
            inviteeName,
          };
        } catch (err) {
          console.warn("[useSentInvitesEnriched] Error enriching invite:", err.message);
          return invite;
        }
      });

      Promise.all(enrichPromises).then(setEnriched).then(() => setEnrichedLoading(false));
    } else {
      setEnriched([]);
      setEnrichedLoading(loading);
    }
  }, [invites, loading]);

  return { invites: enriched, loading: enrichedLoading, error };
}

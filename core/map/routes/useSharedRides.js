import { db } from "@config/firebase";
import { useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AuthContext } from "@context/AuthContext";
import { RIDE_VISIBILITY } from "./sharedRides";

/**
 * Hook to get available shared rides for the user
 * Includes: group rides (for user's groups), public rides, and group rides they're already in
 */
export function useAvailableSharedRides(userGroups = []) {
  const { user } = useContext(AuthContext);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !Array.isArray(userGroups)) {
      setRides([]);
      setLoading(false);
      return;
    }

    const unsubscribes = [];

    // 1. Public rides
    const publicQuery = query(
      collection(db, "routes"),
      where("visibility", "==", RIDE_VISIBILITY.PUBLIC),
      where("isActive", "==", true)
    );

    const unsubPublic = onSnapshot(publicQuery, snap => {
      const publicRides = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRides(prev => {
        const nonPublic = prev.filter(r => r.visibility !== RIDE_VISIBILITY.PUBLIC);
        return [...nonPublic, ...publicRides];
      });
    });
    unsubscribes.push(unsubPublic);

    // 2. Group rides (for groups user is member of)
    if (userGroups.length > 0) {
      const groupQuery = query(
        collection(db, "routes"),
        where("visibility", "==", RIDE_VISIBILITY.GROUP),
        where("isActive", "==", true),
        where("groupId", "in", userGroups.map(g => g.id))
      );

      const unsubGroup = onSnapshot(groupQuery, snap => {
        const groupRides = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRides(prev => {
          const nonGroup = prev.filter(r => r.visibility !== RIDE_VISIBILITY.GROUP);
          return [...nonGroup, ...groupRides];
        });
      });
      unsubscribes.push(unsubGroup);
    }

    setLoading(false);

    return () => unsubscribes.forEach(unsub => unsub?.());
  }, [user, userGroups]);

  return { rides, loading };
}

/**
 * Hook to get active rides created by user
 */
export function useUserActiveRides() {
  const { user } = useContext(AuthContext);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRides([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "routes"),
      where("createdBy", "==", user.uid),
      where("isActive", "==", true)
    );

    const unsubscribe = onSnapshot(q, snap => {
      setRides(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }))
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { rides, loading };
}

/**
 * Hook to check if user is participant in a ride
 */
export function useRideParticipation(routeId) {
  const { user } = useContext(AuthContext);
  const [isParticipant, setIsParticipant] = useState(false);
  const [activeParticipants, setActiveParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !routeId) {
      setIsParticipant(false);
      setActiveParticipants([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "routes"),
      where("__name__", "==", routeId)
    );

    const unsubscribe = onSnapshot(q, snap => {
      if (snap.empty) {
        setIsParticipant(false);
        setActiveParticipants([]);
      } else {
        const route = snap.docs[0].data();
        const participants = route.participants || [];
        const activeParticipants = participants.filter(p => p.status === "active");
        const userIsParticipant = activeParticipants.some(p => p.userId === user.uid);

        setIsParticipant(userIsParticipant);
        setActiveParticipants(activeParticipants);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, routeId]);

  return { isParticipant, activeParticipants, loading };
}

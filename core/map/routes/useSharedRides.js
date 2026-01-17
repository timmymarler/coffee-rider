import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
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
    const ridesMap = new Map();
    let publicLoaded = false;
    let groupLoaded = userGroups.length === 0; // if no groups, consider group loaded

    // 1. Public rides
    const publicQuery = query(
      collection(db, "routes"),
      where("visibility", "==", RIDE_VISIBILITY.PUBLIC),
      where("isActive", "==", true)
    );

    const unsubPublic = onSnapshot(publicQuery, snap => {
      snap.docs.forEach(d => ridesMap.set(d.id, { id: d.id, ...d.data() }));
      publicLoaded = true;
      if (publicLoaded && groupLoaded) {
        setRides(Array.from(ridesMap.values()));
        setLoading(false);
      }
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
        snap.docs.forEach(d => ridesMap.set(d.id, { id: d.id, ...d.data() }));
        groupLoaded = true;
        if (publicLoaded && groupLoaded) {
          setRides(Array.from(ridesMap.values()));
          setLoading(false);
        }
      });
      unsubscribes.push(unsubGroup);
    }

    // loading state will be set when both sources have loaded

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

/**
 * Hook to get shared routes for a specific group
 */
export function useGroupSharedRoutes(groupId) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setRoutes([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "routes"),
      where("visibility", "==", RIDE_VISIBILITY.GROUP),
      where("groupId", "==", groupId)
    );

    const unsubscribe = onSnapshot(q, snap => {
      setRoutes(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }))
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  return { routes, loading };
}

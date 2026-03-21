import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { incMetric } from "@core/utils/devMetrics";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

export function useSavedRides() {
  const { user } = useContext(AuthContext);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRides([]);
      setLoading(false);
      console.log('[useSavedRides] No user logged in, clearing rides');
      return;
    }

    console.log('[useSavedRides] User logged in, initializing ride queries for:', user.uid);

    // Query 1: Old rides from legacy "rides" collection (for backward compatibility)
    const oldRidesQuery = query(
      collection(db, "rides"),
      where("ownerId", "==", user.uid)
    );

    // Query 2: New rides from "routes" collection where type === "ride"
    const newRidesQuery = query(
      collection(db, "routes"),
      where("ownerId", "==", user.uid),
      where("type", "==", "ride")
    );

    const ridesMap = new Map();
    let oldRidesLoaded = false;
    let newRidesLoaded = false;

    const updateRides = () => {
      if (oldRidesLoaded && newRidesLoaded) {
        const rides = Array.from(ridesMap.values());
        console.log('[useSavedRides] Both queries complete. Final rides count:', rides.length, {
          oldLoaded: oldRidesLoaded,
          newLoaded: newRidesLoaded,
          ridesMap: ridesMap.size,
        });
        setRides(rides);
        setLoading(false);
      }
    };

    // Subscribe to old rides
    const unsubOld = onSnapshot(oldRidesQuery, (snap) => {
      incMetric("useSavedRides:oldSnapshot");
      incMetric("useSavedRides:oldDocs", snap.docs.length, 25);
      console.log('[useSavedRides] Old rides query returned', snap.docs.length, 'documents from "rides" collection');
      snap.docs.forEach((doc) => {
        // Store with "old_" prefix to avoid conflicts with new rides
        const rideId = doc.id;
        const rideData = doc.data();
        // Normalize old rides to use routePolyline if it has ridePolyline
        if (rideData.ridePolyline && !rideData.routePolyline) {
          rideData.routePolyline = rideData.ridePolyline;
        }
        ridesMap.set(rideId, { id: rideId, ...rideData, _source: "old" });
      });
      oldRidesLoaded = true;
      updateRides();
    }, (err) => {
      console.error('[useSavedRides] Error listening to old rides:', {
        code: err.code,
        message: err.message,
        user: user.uid,
      });
      oldRidesLoaded = true;
      updateRides();
    });

    // Subscribe to new rides
    const unsubNew = onSnapshot(newRidesQuery, (snap) => {
      incMetric("useSavedRides:newSnapshot");
      incMetric("useSavedRides:newDocs", snap.docs.length, 25);
      console.log('[useSavedRides] New rides query returned', snap.docs.length, 'documents from "routes" collection');
      snap.docs.forEach((doc) => {
        const rideData = doc.data();
        console.log('[useSavedRides] Ride doc:', {
          id: doc.id,
          type: rideData.type,
          deleted: rideData.deleted,
          name: rideData.name,
          createdAt: rideData.createdAt,
          completedAt: rideData.completedAt,
          polylineLength: rideData.routePolyline?.length || 0,
          hasPolyline: !!rideData.routePolyline,
          docSize: new Blob([JSON.stringify(rideData)]).size,
        });
        ridesMap.set(doc.id, { id: doc.id, ...rideData, _source: "new" });
      });
      newRidesLoaded = true;
      updateRides();
    }, (err) => {
      console.error('[useSavedRides] Error listening to new rides:', {
        code: err.code,
        message: err.message,
        user: user.uid,
      });
      newRidesLoaded = true;
      updateRides();
    });

    return () => {
      console.log('[useSavedRides] Cleaning up ride subscriptions');
      unsubOld();
      unsubNew();
    };
  }, [user]);

  return { rides, loading };
}

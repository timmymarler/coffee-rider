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
      return;
    }

    // Query user's own rides
    const userRidesQuery = query(
      collection(db, "rides"),
      where("createdBy", "==", user.uid)
    );

    const ridesMap = new Map();
    let userRidesLoaded = false;

    const updateRides = () => {
      if (userRidesLoaded) {
        setRides(Array.from(ridesMap.values()));
        setLoading(false);
      }
    };

    const unsubUser = onSnapshot(userRidesQuery, (snap) => {
      incMetric("useSavedRides:userSnapshot");
      incMetric("useSavedRides:userDocs", snap.docs.length, 25);
      snap.docs.forEach((doc) => {
        ridesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      userRidesLoaded = true;
      updateRides();
    }, (err) => {
      if (err.code !== "permission-denied") {
        console.error("Error listening to user rides:", err);
      }
      userRidesLoaded = true;
      updateRides();
    });

    return () => {
      unsubUser();
    };
  }, [user]);

  return { rides, loading };
}

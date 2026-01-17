import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { incMetric } from "@core/utils/devMetrics";
import { useContext, useEffect, useState } from "react";

export function useSavedRoutes(includePublic = false) {
  const { user, role = "guest" } = useContext(AuthContext);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoutes([]);
      setLoading(false);
      return;
    }

    // Query 1: User's own routes
    const userRoutesQuery = query(
      collection(db, "routes"),
      where("createdBy", "==", user.uid)
    );

    // Query 2: Public routes from all users (optional)
    const publicRoutesQuery = includePublic
      ? query(
          collection(db, "routes"),
          where("visibility", "==", "public")
        )
      : null;

    const routesMap = new Map();
    let userRoutesLoaded = false;
    let publicRoutesLoaded = !includePublic; // if not including public, treat as loaded

    const updateRoutes = () => {
      if (userRoutesLoaded && publicRoutesLoaded) {
        setRoutes(Array.from(routesMap.values()));
        setLoading(false);
      }
    };

    const unsubUser = onSnapshot(userRoutesQuery, snap => {
      incMetric("useSavedRoutes:userSnapshot");
      incMetric("useSavedRoutes:userDocs", snap.docs.length, 25);
      snap.docs.forEach(doc => {
        routesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      userRoutesLoaded = true;
      updateRoutes();
    });

    const unsubPublic = publicRoutesQuery
      ? onSnapshot(publicRoutesQuery, snap => {
          incMetric("useSavedRoutes:publicSnapshot");
          incMetric("useSavedRoutes:publicDocs", snap.docs.length, 25);
          snap.docs.forEach(doc => {
            routesMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
          publicRoutesLoaded = true;
          updateRoutes();
        })
      : null;

    return () => {
      unsubUser();
      unsubPublic && unsubPublic();
    };
  }, [user, includePublic]);

  return { routes, loading };
}

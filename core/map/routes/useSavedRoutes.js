import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { incMetric } from "@core/utils/devMetrics";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

/**
 * Fetch user's saved routes
 * 
 * @param {Boolean} includePublic - Include public routes from other users
 * @param {Boolean} includeDeleted - Include soft-deleted routes (within 30-day window)
 * @returns {Object} { routes: Route[], loading: Boolean }
 */
export function useSavedRoutes(includePublic = false, includeDeleted = false) {
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
        // Filter deleted routes unless includeDeleted is true
        const filteredRoutes = Array.from(routesMap.values()).filter(route => {
          if (includeDeleted) return true; // Include all routes
          return !route.deleted; // Exclude deleted routes
        });
        setRoutes(filteredRoutes);
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
    }, (err) => {
      // Ignore permission errors when user is logging out
      if (err.code !== 'permission-denied') {
        console.error("Error listening to user routes:", err);
      }
      userRoutesLoaded = true;
      updateRoutes();
    });

    const unsubPublic = publicRoutesQuery
      ? onSnapshot(publicRoutesQuery, snap => {
          incMetric("useSavedRoutes:publicSnapshot");
          incMetric("useSavedRoutes:publicDocs", snap.docs.length, 25);
          snap.docs.forEach(doc => {
            // Only include non-deleted public routes
            if (!doc.data().deleted) {
              routesMap.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
          publicRoutesLoaded = true;
          updateRoutes();
        })
      : null;

    return () => {
      unsubUser();
      unsubPublic && unsubPublic();
    };
  }, [user, includePublic, includeDeleted]);

  return { routes, loading };
}

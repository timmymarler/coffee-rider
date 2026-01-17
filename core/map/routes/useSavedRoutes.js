import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

export function useSavedRoutes() {
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

    // Query 2: Public routes from all users
    const publicRoutesQuery = query(
      collection(db, "routes"),
      where("visibility", "==", "public")
    );

    const routesMap = new Map();
    let userRoutesLoaded = false;
    let publicRoutesLoaded = false;

    const updateRoutes = () => {
      if (userRoutesLoaded && publicRoutesLoaded) {
        setRoutes(Array.from(routesMap.values()));
        setLoading(false);
      }
    };

    const unsubUser = onSnapshot(userRoutesQuery, snap => {
      snap.docs.forEach(doc => {
        routesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      userRoutesLoaded = true;
      updateRoutes();
    });

    const unsubPublic = onSnapshot(publicRoutesQuery, snap => {
      snap.docs.forEach(doc => {
        routesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      publicRoutesLoaded = true;
      updateRoutes();
    });

    return () => {
      unsubUser();
      unsubPublic();
    };
  }, [user]);

  return { routes, loading };
}

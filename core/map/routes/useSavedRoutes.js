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

    const q = query(
      collection(db, "routes"),
      where("createdBy", "==", user.uid)
    );

    const unsub = onSnapshot(q, snap => {
      setRoutes(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }))
      );
      setLoading(false);
    });

    return unsub;
  }, [user]);

  return { routes, loading };
}

import { db } from "@/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export function useSavedRoutes(user) {
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "routes"),
      where("createdBy", "==", user.uid)
    );

    return onSnapshot(q, snap => {
      setRoutes(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });
  }, [user]);

  return routes;
}

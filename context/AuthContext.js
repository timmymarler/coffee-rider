import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("guest");
  const [can, setCan] = useState(getPermissions("guest"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // ----------- GUEST -----------
        setUser(null);
        setRole("guest");
        setCan(getPermissions("guest"));
        setLoading(false);
        return;
      }

      // ----------- LOGGED IN -----------
      setUser(firebaseUser);

      try {
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        // IMPORTANT: default to guest, not user
        let roleValue = "guest";

        if (snap.exists()) {
          const data = snap.data();
          roleValue = data.role || "user";  // only upgrade to user if doc says so
        }

        setRole(roleValue);
        setCan(getPermissions(roleValue));

      } catch (e) {
        console.error("Error loading role:", e);
        setRole("guest");
        setCan(getPermissions("guest"));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, can, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ======================================================================
// Permissions
// ======================================================================

function getPermissions(role) {
  return {
    addCafe: role === "user" || role === "pro" || role === "admin",
    addPhoto: role === "user" || role === "pro" || role === "admin",
    comment: role === "pro" || role === "admin",
    editComment: role === "pro" || role === "admin",
    navigation: role === "user" || role === "pro" || role === "admin",
    waypoints: role === "pro" || role === "admin",
    saveRoutes: role === "pro" || role === "admin",
    viewRoutes: role === "pro" || role === "admin",
    admin: role === "admin",
  };
}

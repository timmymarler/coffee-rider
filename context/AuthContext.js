import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("guest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);

          const ref = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            const data = snap.data();
            setRole(data.role || "user");
            console.log("User signed in, role:", data.role || "user");
          } else {
            console.warn("No Firestore user doc found, defaulting to 'user'");
            setRole("user");
          }
        } else {
          setUser(null);
          setRole("guest");
          console.log("No user signed in, role set to guest");
        }
      } catch (err) {
        console.error("Auth context error:", err);
        setRole("guest");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Role-based permissions helper
  const can = {
    addCafe: ["user", "pro", "admin"].includes(role),
    manageCafes: ["admin"].includes(role),
  };

  return (
    <AuthContext.Provider value={{ user, role, can, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

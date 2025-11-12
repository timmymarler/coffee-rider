import { createContext, useEffect, useState, useContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

const AuthContext = createContext({ user: null });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        setUser(usr);

        try {
          // reference to the user document in Firestore
          const userRef = doc(db, "users", usr.uid);
          const snap = await getDoc(userRef);

          // if it doesn't exist, create it
          if (!snap.exists()) {
            await setDoc(userRef, {
              displayName: usr.displayName || "New Rider",
              email: usr.email,
              avatarURL: usr.photoURL || null,
              friends: [],
              friendRequests: [],
              sentRequests: [],
              createdAt: new Date().toISOString(),
            });
            console.log("New user profile created:", usr.uid);
          }
        } catch (err) {
          console.error("Error checking/creating user profile:", err);
        }
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { auth } from "@config/firebase";
import { ensureUserDocument, getUserProfile } from "@firebaseLocal/users";
import { onAuthStateChanged } from "firebase/auth";
import { createContext, useEffect, useState } from "react";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // Make sure the user exists in Firestore
      await ensureUserDocument(firebaseUser.uid);

      // Load profile (role + subscriptionStatus)
      const profileData = await getUserProfile(firebaseUser.uid);
      setProfile(profileData);

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

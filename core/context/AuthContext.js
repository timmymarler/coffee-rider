// core/context/AuthContext.js

import { auth } from "@config/firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { createContext, useEffect, useState } from "react";

import { getCapabilities } from "@core/roles/getCapabilities";
import {
  ensureUserDocument,
  getUserProfile
} from "@firebaseLocal/users";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Firebase Auth user
  const [profile, setProfile] = useState(null); // Firestore profile doc (role, etc.)
  const [loading, setLoading] = useState(true);

  // ----------------------------------------
  // ACTIONS
  // ----------------------------------------

  async function login(email, password) {
    const res = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocument(res.user.uid, res.user);
    return res.user;
  }

  async function logout() {
    await signOut(auth);
  }

  async function register(email, password, displayName) {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(res.user, { displayName });
    }

    await ensureUserDocument(res.user.uid, res.user);
    return res.user;
  }

  // Refresh Firestore profile after any update (photo, name, etc.)
  async function refreshProfile() {
    if (!user) return null;
    const updated = await getUserProfile(user.uid);
    setProfile(updated);
    return updated;
  }

  // ----------------------------------------
  // AUTH STATE
  // ----------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);

        await ensureUserDocument(firebaseUser.uid, firebaseUser);
        const profileData = await getUserProfile(firebaseUser.uid);
        setProfile(profileData || null);
      } catch (err) {
        console.error("AuthContext error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // ----------------------------------------
  // ROLE + CAPABILITIES
  // ----------------------------------------
  const role = profile?.role || "guest";
  const capabilities = getCapabilities(role);

  const value = {
    user,
    profile,
    role,
    capabilities,
    loading,
    login,
    logout,
    register,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// core/context/AuthContext.js

import { auth, db } from "@config/firebase";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";

import { getCapabilities } from "@core/roles/capabilities";
import { checkVersionStatus, fetchVersionInfo } from "@core/utils/versionCheck";
import {
    ensureUserDocument,
    getUserProfile
} from "@firebaseLocal/users";
import Constants from "expo-constants";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Firebase Auth user
  const [profile, setProfile] = useState(null); // Firestore profile doc (role, etc.)
  const [loading, setLoading] = useState(true);
  const [versionStatus, setVersionStatus] = useState({
    status: "current",
    hasUpdate: false,
    isRequired: false,
    versionInfo: null,
  });

  // ----------------------------------------
  // ACTIONS
  // ----------------------------------------

  async function login(email, password) {
    const res = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocument(res.user.uid, res.user);
    
    // Clear any stale active ride records on login
    try {
      await deleteDoc(doc(db, 'activeRides', res.user.uid));
    } catch (err) {
      // Silently fail if document doesn't exist or other error
      if (err.code !== 'not-found') {
        console.warn('[AuthContext] Error clearing stale activeRide on login:', err.message);
      }
    }
    
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
    
    // Clear any stale active ride records on register (shouldn't exist, but be safe)
    try {
      await deleteDoc(doc(db, 'activeRides', res.user.uid));
    } catch (err) {
      // Silently fail if document doesn't exist
      if (err.code !== 'not-found') {
        console.warn('[AuthContext] Error clearing activeRide on register:', err.message);
      }
    }
    
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
  // VERSION CHECK
  // ----------------------------------------
  useEffect(() => {
    async function checkVersion() {
      try {
        const appName = Constants.expoConfig?.extra?.appName || "rider";
        const currentVersion = Constants.expoConfig?.version || "1.0.0";
        
        const versionInfo = await fetchVersionInfo(appName);
        const status = checkVersionStatus(currentVersion, versionInfo);
        
        setVersionStatus(status);

        if (status.isRequired) {
          console.warn("[VERSION] Update required:", status.versionInfo);
        } else if (status.hasUpdate) {
          console.log("[VERSION] Update available:", status.versionInfo);
        }
      } catch (error) {
        // Silently fail if offline or network error
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
          console.log("[VERSION] Version check skipped (offline)");
        } else {
          console.error("[VERSION] Error checking version:", error);
        }
      }
    }

    checkVersion();
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
    versionStatus,
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

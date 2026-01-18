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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

import { getCapabilities } from "@core/roles/capabilities";
import { checkVersionStatus, fetchVersionInfo } from "@core/utils/versionCheck";
import {
    ensureUserDocument,
    getUserProfile
} from "@firebaseLocal/users";
import Constants from "expo-constants";

export const AuthContext = createContext(null);

const SESSION_KEY = '@coffee_rider_session';
const SESSION_EXPIRY_DAYS = 14; // 14 days of inactivity before auto-logout

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
  // SESSION PERSISTENCE
  // ----------------------------------------

  async function saveSession(firebaseUser) {
    try {
      const sessionData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        lastUsed: Date.now(),
        expiresAt: Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      console.log('[AuthContext] Session saved');
    } catch (err) {
      console.error('[AuthContext] Error saving session:', err);
    }
  }

  async function loadSession() {
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored);
      const now = Date.now();

      // Check if session has expired
      if (now > session.expiresAt) {
        console.log('[AuthContext] Session expired, clearing');
        await AsyncStorage.removeItem(SESSION_KEY);
        return null;
      }

      console.log('[AuthContext] Valid session found for:', session.email);
      return session;
    } catch (err) {
      console.error('[AuthContext] Error loading session:', err);
      return null;
    }
  }

  async function clearSession() {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
      console.log('[AuthContext] Session cleared');
    } catch (err) {
      console.error('[AuthContext] Error clearing session:', err);
    }
  }

  async function updateSessionLastUsed() {
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        session.lastUsed = Date.now();
        session.expiresAt = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
        console.log('[AuthContext] Session activity updated');
      }
    } catch (err) {
      console.error('[AuthContext] Error updating session:', err);
    }
  }

  // ----------------------------------------
  // ACTIONS
  // ----------------------------------------

  async function login(email, password) {
    const res = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocument(res.user.uid, res.user);
    
    // Save session for persistence
    await saveSession(res.user);
    
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
    await clearSession();
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
  // AUTH STATE & SESSION RESTORE
  // ----------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          // No Firebase user, but check for stored session
          const session = await loadSession();
          if (session) {
            // Session still valid, stay logged in
            // Firebase will re-auth if the session token is still good
            setLoading(false);
            return;
          }

          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);
        await saveSession(firebaseUser);

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

  // Track app foreground/background to update session activity
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && user) {
        // App came to foreground, refresh session
        await updateSessionLastUsed();
      }
    });

    return () => subscription.remove();
  }, [user]);

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

// core/context/AuthContext.js

import { auth, db } from "@config/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";
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
const GUEST_MODE_KEY = '@coffee_rider_guest_mode';
const SESSION_EXPIRY_DAYS = 14; // 14 days of inactivity before auto-logout

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Firebase Auth user
  const [profile, setProfile] = useState(null); // Firestore profile doc (role, etc.)
  const [isGuest, setIsGuest] = useState(false); // Guest mode flag
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false); // Email verification status
  const [needsAppleEmailSetup, setNeedsAppleEmailSetup] = useState(false); // Apple user needs to add email
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

  async function saveGuestMode() {
    try {
      await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
      console.log('[AuthContext] Guest mode saved');
    } catch (err) {
      console.error('[AuthContext] Error saving guest mode:', err);
    }
  }

  async function loadGuestMode() {
    try {
      const saved = await AsyncStorage.getItem(GUEST_MODE_KEY);
      return saved === 'true';
    } catch (err) {
      console.error('[AuthContext] Error loading guest mode:', err);
      return false;
    }
  }

  async function clearGuestMode() {
    try {
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      console.log('[AuthContext] Guest mode cleared');
    } catch (err) {
      console.error('[AuthContext] Error clearing guest mode:', err);
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
    setIsGuest(false);
    await signOut(auth);
  }

  async function enterGuestMode() {
    console.log('[AuthContext] Entering guest mode');
    setIsGuest(true);
    setLoading(false);
    await saveGuestMode();
  }

  async function exitGuestMode() {
    console.log('[AuthContext] Exiting guest mode');
    setIsGuest(false);
    await clearGuestMode();
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

  // Set flag for Apple users to add email
  function requireAppleEmailSetup() {
    setNeedsAppleEmailSetup(true);
  }

  // Clear flag after email setup complete
  function completeAppleEmailSetup() {
    setNeedsAppleEmailSetup(false);
  }

  // ----------------------------------------
  // INITIALIZATION: Restore guest mode and session on app startup
  // ----------------------------------------
  useEffect(() => {
    async function init() {
      const wasInGuestMode = await loadGuestMode();
      if (wasInGuestMode) {
        console.log('[AuthContext] Restoring guest mode from storage');
        setIsGuest(true);
      }
    }
    init();
  }, []);

  // ----------------------------------------
  // AUTH STATE & SESSION RESTORE
  // ----------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] onAuthStateChanged fired. firebaseUser:', firebaseUser ? firebaseUser.email : null);
      try {
        if (!firebaseUser) {
          console.log('[AuthContext] No firebaseUser. Setting user to null.');
          setUser(null);
          setProfile(null);
          setEmailVerified(false);
          // Don't change loading state if we're in guest mode - let the initialization effect handle it
          if (!isGuest) {
            setLoading(false);
          }
          return;
        }

        console.log('[AuthContext] firebaseUser detected:', firebaseUser.email);
        console.log('[AuthContext] emailVerified:', firebaseUser.emailVerified);
        setUser(firebaseUser);
        setEmailVerified(firebaseUser.emailVerified);
        setIsGuest(false); // Clear guest mode when user logs in
        await clearGuestMode();
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
  }, [isGuest]);

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
    isGuest,
    emailVerified,
    loading,
    versionStatus,
    needsAppleEmailSetup,
    login,
    logout,
    register,
    refreshProfile,
    enterGuestMode,
    exitGuestMode,
    requireAppleEmailSetup,
    completeAppleEmailSetup,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

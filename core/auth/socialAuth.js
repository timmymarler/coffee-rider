// core/auth/socialAuth.js
import { auth, db } from "@config/firebase";
import {
    GoogleAuthProvider,
    OAuthProvider,
    signInWithCredential,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";

// Conditionally import Apple Sign-in (only available after native compilation)
let AppleAuthentication = null;

try {
  if (Platform.OS === "ios") {
    AppleAuthentication = require("expo-apple-authentication");
  }
} catch (error) {
  console.warn("[SocialAuth] Apple Sign-in not available. Run 'expo prebuild' and 'expo run:ios' to enable it.");
}

// Conditionally import Google Sign-in (only available after native compilation)
let GoogleSignin = null;
let statusCodes = {};

try {
  if (Platform.OS !== "web") {
    const googleModule = require("@react-native-google-signin/google-signin");
    GoogleSignin = googleModule.GoogleSignin;
    statusCodes = googleModule.statusCodes;
  }
} catch (error) {
  console.warn("[SocialAuth] Google Sign-in not available. Run 'expo prebuild' and 'expo run:ios' or 'expo run:android' to enable it.");
}

/**
 * Initialize Google Sign-in
 * Should be called once when app starts
 */
export const initializeGoogleSignIn = () => {
  if (!GoogleSignin) {
    console.log("[SocialAuth] Google Sign-in not available on this build");
    return;
  }

  if (Platform.OS === "web") {
    console.log("[SocialAuth] Skipping Google Sign-in init on web");
    return;
  }

  try {
    GoogleSignin.configure({
      webClientId:
        "1001945286149-4oq0pkng0mlfps1vje2es9h69ja5561v.apps.googleusercontent.com",
      iosClientId:
        "1001945286149-vkem3dmdu6p4mld7vp5j2atncvv97uct.apps.googleusercontent.com",
      offlineAccess: true,
      scopes: ["profile", "email"],
    });
    console.log("[SocialAuth] Google Sign-in initialized");
  } catch (error) {
    console.error("[SocialAuth] Error initializing Google Sign-in:", error);
  }
};

/**
 * Check if Google Sign-in is available
 */
export const isGoogleSignInAvailable = () => {
  return GoogleSignin !== null;
};

/**
 * Check if Apple Sign-in is available
 */
export const isAppleSignInAvailable = () => {
  return AppleAuthentication !== null;
};

/**
 * Sign in with Google
 * @returns {Promise<{user, isNewUser}>}
 */
export const signInWithGoogle = async () => {
  if (!GoogleSignin) {
    throw new Error("Google Sign-in is not available on this build. Please run 'expo prebuild' and 'expo run:ios' or 'expo run:android'.");
  }

  try {
    console.log("[SocialAuth] Starting Google Sign-in...");

    // Check if device has Google Play services
    try {
      await GoogleSignin.hasPlayServices();
      console.log("[SocialAuth] ✓ Google Play Services available");
    } catch (playServicesError) {
      console.error("[SocialAuth] Play Services error:", playServicesError);
      throw playServicesError;
    }

    // Get the user's ID and access token
    console.log("[SocialAuth] Attempting to sign in with GoogleSignin.signIn()...");
    const response = await GoogleSignin.signIn();
    console.log("[SocialAuth] Response received:", response ? "yes" : "null");

    // Handle cancel or missing response
    if (!response || !response.data || !response.data.idToken) {
      throw new Error("Google Sign-in was cancelled");
    }

    console.log("[SocialAuth] Got Google ID token, signing into Firebase...");

    // Create Firebase credential from Google token
    const credential = GoogleAuthProvider.credential(response.data.idToken);

    // Sign in to Firebase with the credential
    const result = await signInWithCredential(auth, credential);
    const firebaseUser = result.user;

    // Check if user doc exists to preserve user edits
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userSnapshot = await getDoc(userDocRef);
    
    try {
      if (!userSnapshot.exists()) {
        // New user - set all fields including displayName and contactEmail
        await setDoc(
          userDocRef,
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            contactEmail: firebaseUser.email, // Use real email for group invites
            displayName: firebaseUser.displayName || "Google User",
            photoURL: firebaseUser.photoURL,
            role: "user",
            authProvider: "google",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
      } else {
        // Existing user - only update photoURL, preserve displayName and contactEmail that user may have edited
        await updateDoc(userDocRef, {
          photoURL: firebaseUser.photoURL,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.log("[SocialAuth] Error creating/updating user doc:", e.message);
    }

    console.log("[SocialAuth] ✓ Google sign-in successful");
    return {
      user: firebaseUser,
      isNewUser: result.additionalUserInfo?.isNewUser || false,
    };
  } catch (error) {
    // Check for cancellation first - don't log if user just cancelled
    if (error.message?.includes("was cancelled") || error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Google Sign-in was cancelled");
    }

    // Log actual errors with FULL details for debugging
    console.error("[SocialAuth] ===== GOOGLE SIGN-IN ERROR =====");
    console.error("[SocialAuth] Error type:", typeof error);
    console.error("[SocialAuth] Error.message:", error.message);
    console.error("[SocialAuth] Error.code:", error.code);
    console.error("[SocialAuth] Error.toString():", error.toString());
    console.error("[SocialAuth] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

    if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Google Sign-in is already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services not available on this device");
    } else if (error.code === "DEVELOPER_ERROR" || error.message?.includes("DEVELOPER_ERROR")) {
      console.error("[SocialAuth] DEVELOPER_ERROR detected - likely SHA-1 or package name mismatch");
      throw new Error("Google Sign-in configuration error. Please ensure SHA-1 certificate fingerprint matches Google Cloud Console configuration:\nhttps://react-native-google-signin.github.io/docs/troubleshooting");
    } else {
      throw new Error(
        error.message || "Google Sign-in failed. Please try again."
      );
    }
  }
};

/**
 * Sign in with Apple
 * @returns {Promise<{user, isNewUser}>}
 */
export const signInWithApple = async () => {
  if (!AppleAuthentication) {
    throw new Error("Apple Sign-in is not available on this build. Please run 'expo prebuild' and 'expo run:ios'.");
  }

  try {
    console.log("[SocialAuth] Starting Apple Sign-in...");

    // Request Apple Sign-in with error handling
    let credential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      console.log("[SocialAuth] ✓ Apple credential received");
    } catch (appleError) {
      console.error("[SocialAuth] Apple native error codes:", appleError.code);
      console.error("[SocialAuth] Apple native error message:", appleError.message);
      if (appleError.code === "ERR_CANCELLED" || appleError.message?.includes("cancelled")) {
        throw new Error("Apple Sign-in was cancelled");
      }
      throw appleError;
    }

    if (!credential.identityToken) {
      throw new Error("No identity token received from Apple");
    }

    console.log("[SocialAuth] Got Apple identity token, signing into Firebase...");

    // Create Firebase credential from Apple token
    const provider = new OAuthProvider("apple.com");
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken,
      rawNonce: credential.nonce,
    });

    // Sign in to Firebase
    const result = await signInWithCredential(auth, firebaseCredential);
    const firebaseUser = result.user;

    // Get display name from Apple credential if available
    let displayName = firebaseUser.displayName;
    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      const givenName = credential.fullName?.givenName || "";
      const familyName = credential.fullName?.familyName || "";
      displayName = `${givenName} ${familyName}`.trim();
    }
    
    // If still no name, use first part of email or a generic name
    if (!displayName) {
      displayName = firebaseUser.email?.split("@")[0] || "Coffee Rider User";
    }

    // Create user doc if it doesn't exist - preserve user edits on re-login
    const userDocRef = doc(db, "users", firebaseUser.uid);
    try {
      const userSnapshot = await getDoc(userDocRef);
      
      if (!userSnapshot.exists()) {
        // New user - set all fields including displayName and contactEmail
        await setDoc(
          userDocRef,
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            contactEmail: null, // Apple users will set this in Profile when upgrading
            displayName: displayName,
            role: "user",
            authProvider: "apple",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
      } else {
        // Existing user - don't overwrite displayName or contactEmail that user may have edited
        // Just update timestamp
        await updateDoc(userDocRef, {
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.log("[SocialAuth] Error creating/updating user doc:", e.message);
    }

    console.log("[SocialAuth] ✓ Apple sign-in successful");
    return {
      user: firebaseUser,
      isNewUser: result.additionalUserInfo?.isNewUser || false,
    };
  } catch (error) {
    // Check for cancellation first - don't log if user just cancelled
    if (error.code === "ERR_CANCELLED" || error.message?.includes("was cancelled")) {
      throw new Error("Apple Sign-in was cancelled");
    }

    // Log actual errors with full details
    console.error("[SocialAuth] ===== APPLE SIGN-IN ERROR =====");
    console.error("[SocialAuth] Error.code:", error.code);
    console.error("[SocialAuth] Error.message:", error.message);
    console.error("[SocialAuth] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

    throw new Error(
      error.message || "Apple Sign-in failed. Please try again."
    );
  }
};

/**
 * Sign out from Google
 */
export const signOutFromGoogle = async () => {
  try {
    if (Platform.OS !== "web") {
      await GoogleSignin.signOut();
      console.log("[SocialAuth] ✓ Signed out from Google");
    }
  } catch (error) {
    console.error("[SocialAuth] Error signing out from Google:", error);
  }
};

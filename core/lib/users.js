// core/lib/users.js

import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

// The only fields clients may read publicly:
const PUBLIC_USER_FIELDS = [
  "displayName",
  "photoURL",
  "bike",
  "homeLocation",
  "bio",
];

/**
 * Fetch a user's public profile safely.
 * Filters out non-public fields (email, role, subscriptionStatus, etc.)
 */


export async function getPublicUserProfile(userId) {
  try {
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return {
        displayName: "Unknown",
        photoURL: null,
      };
    }

    const data = snap.data();

    return {
      displayName: data.displayName || "Unknown",
      photoURL: data.photoURL || null,
    };
  } catch (err) {
    console.error("getPublicUserProfile error:", err);
    return {
      displayName: "Unknown",
      photoURL: null,
    };
  }
}

import { updateDoc } from "firebase/firestore";

/**
 * Update the logged-in user's profile using ONLY safe fields.
 * Will never attempt to write email, role, or subscriptionStatus.
 */
export async function updatePublicUserProfile(userId, updates) {
  if (!userId) throw new Error("Missing userId");

  // Remove disallowed fields
  const disallowed = ["email", "role", "subscriptionStatus", "createdAt", "updatedAt"];

  const safeUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (!disallowed.includes(k)) {
      safeUpdates[k] = v;
    }
  }

  return updateDoc(doc(db, "users", userId), safeUpdates);
}

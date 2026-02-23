// core/firebase/users.js

import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

export async function ensureUserDocument(uid, authUser = null) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const fallbackUser = authUser || auth.currentUser;
    const userEmail = fallbackUser?.email || "";
    
    // For Apple Privacy Relay emails, don't set contactEmail (will be set by modal)
    // For other emails (Google, email/password), use as contactEmail for group invites
    const isApplePrivacyRelay = userEmail.includes("@privaterelay.appleid.com");
    
    await setDoc(ref, {
      email: userEmail,
      contactEmail: isApplePrivacyRelay ? null : userEmail,
      displayName: fallbackUser?.displayName || "",
      role: "user",
      subscriptionStatus: "free",
      createdAt: new Date().toISOString(),
    });
  }
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function findUserByContactEmail(contactEmail) {
  if (!contactEmail) return null;
  
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("contactEmail", "==", contactEmail));
  const result = await getDocs(q);
  
  if (result.empty) return null;
  
  // Return first match with UID
  const docSnap = result.docs[0];
  return {
    uid: docSnap.id,
    ...docSnap.data(),
  };
}


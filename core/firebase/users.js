// core/firebase/users.js

import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

export async function ensureUserDocument(uid, authUser = null) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const fallbackUser = authUser || auth.currentUser;

    await setDoc(ref, {
      email: fallbackUser?.email || "",
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

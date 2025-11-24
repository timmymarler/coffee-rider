import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

export async function ensureUserDocument(uid, data = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      role: "user",
      subscriptionStatus: "free",
      createdAt: new Date().toISOString(),
      ...data
    });
  }
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// core/firebase/users.js

import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

function normalizeEmailValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function ensureUserDocument(uid, authUser = null) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const fallbackUser = authUser || auth.currentUser;
    const userEmail = fallbackUser?.email || "";
    const normalizedEmail = normalizeEmailValue(userEmail);
    
    // For Apple Privacy Relay emails, don't set contactEmail (will be set by modal)
    // For other emails (Google, email/password), use as contactEmail for group invites
    const isApplePrivacyRelay = normalizedEmail.includes("@privaterelay.appleid.com");
    
    await setDoc(ref, {
      email: normalizedEmail || userEmail,
      contactEmail: isApplePrivacyRelay ? null : (normalizedEmail || null),
      displayName: fallbackUser?.displayName || "",
      role: "user",
      subscriptionStatus: "free",
      excludeFromUserSearch: false,
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
  const normalizedEmail = normalizeEmailValue(contactEmail);
  if (!normalizedEmail) return null;

  const usersRef = collection(db, "users");

  const exactQueries = [
    query(usersRef, where("contactEmail", "==", normalizedEmail)),
    query(usersRef, where("email", "==", normalizedEmail)),
  ];

  for (const exactQuery of exactQueries) {
    const result = await getDocs(exactQuery);
    if (!result.empty) {
      const docSnap = result.docs[0];
      return {
        uid: docSnap.id,
        ...docSnap.data(),
      };
    }
  }

  const snapshot = await getDocs(usersRef);
  const matchedDoc = snapshot.docs.find((docSnap) => {
    const data = docSnap.data() || {};
    return (
      normalizeEmailValue(data.contactEmail) === normalizedEmail ||
      normalizeEmailValue(data.email) === normalizedEmail
    );
  });

  if (!matchedDoc) return null;

  return {
    uid: matchedDoc.id,
    ...matchedDoc.data(),
  };
}

export async function searchUsersByNameOrEmail(searchTerm, { excludeUid = null, excludeUids = [], limit = 12 } = {}) {
  const normalizedTerm = typeof searchTerm === "string" ? searchTerm.trim().toLowerCase() : "";
  if (!normalizedTerm) return [];

  const excluded = new Set([excludeUid, ...(Array.isArray(excludeUids) ? excludeUids : [])].filter(Boolean));
  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        uid: docSnap.id,
        ...data,
      };
    })
    .filter((candidate) => {
      if (!candidate?.uid || excluded.has(candidate.uid)) return false;
      if (candidate.excludeFromUserSearch === true) return false;

      const displayName = String(candidate.displayName || candidate.name || "").trim().toLowerCase();
      const contactEmail = normalizeEmailValue(candidate.contactEmail);
      const email = normalizeEmailValue(candidate.email);

      return (
        displayName.includes(normalizedTerm) ||
        contactEmail.includes(normalizedTerm) ||
        email.includes(normalizedTerm)
      );
    })
    .sort((a, b) => {
      const aName = String(a.displayName || a.name || "").trim().toLowerCase();
      const bName = String(b.displayName || b.name || "").trim().toLowerCase();
      const aEmail = normalizeEmailValue(a.contactEmail || a.email);
      const bEmail = normalizeEmailValue(b.contactEmail || b.email);

      const score = (name, email) => {
        if (name === normalizedTerm || email === normalizedTerm) return 0;
        if (name.startsWith(normalizedTerm) || email.startsWith(normalizedTerm)) return 1;
        return 2;
      };

      return score(aName, aEmail) - score(bName, bEmail);
    })
    .slice(0, limit);
}


// core/firebase/users.js

import { doc, getDoc, setDoc, collection, query, where, getDocs, runTransaction } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

function normalizeEmailValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeDisplayNameValue(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function displayNameKey(value) {
  const normalized = normalizeDisplayNameValue(value);
  if (!normalized) return "";
  return normalized.replace(/\//g, "_");
}

function maskEmailValue(value) {
  const normalized = normalizeEmailValue(value);
  if (!normalized || !normalized.includes("@")) return "";
  const [userPart, domainPart] = normalized.split("@");
  const [domainName, ...domainRest] = domainPart.split(".");
  const topLevel = domainRest.length > 0 ? domainRest.join(".") : "";
  const safeUser = userPart.length <= 2
    ? `${userPart.charAt(0) || ""}***`
    : `${userPart.charAt(0)}***${userPart.charAt(userPart.length - 1)}`;
  const safeDomain = domainName ? `${domainName.charAt(0)}***` : "***";
  const safeTld = topLevel ? topLevel : "***";
  return `${safeUser}@${safeDomain}.${safeTld}`;
}

async function findConflictingDisplayNameUid(displayName, excludeUid = null) {
  const normalized = normalizeDisplayNameValue(displayName);
  if (!normalized) return null;

  const snapshot = await getDocs(collection(db, "users"));
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() || {};
    const uid = docSnap.id;
    if (!uid || (excludeUid && uid === excludeUid)) continue;

    const candidate = normalizeDisplayNameValue(data.displayName || data.name || "");
    if (candidate && candidate === normalized) {
      return uid;
    }
  }

  return null;
}

export async function reserveDisplayName(uid, displayName) {
  const key = displayNameKey(displayName);
  if (!uid || !key) {
    throw new Error("Display name required");
  }

  const conflictingUid = await findConflictingDisplayNameUid(displayName, uid);
  if (conflictingUid) {
    throw new Error("Display name already taken");
  }

  const ref = doc(db, "usernames", key);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.exists()) {
      const data = snap.data() || {};
      if (data.uid !== uid) {
        throw new Error("Display name already taken");
      }
      transaction.set(ref, { uid, displayName, updatedAt: new Date().toISOString() }, { merge: true });
      return;
    }
    transaction.set(ref, { uid, displayName, createdAt: new Date().toISOString() });
  });
}

export async function isDisplayNameAvailable(displayName) {
  const key = displayNameKey(displayName);
  if (!key) return false;
  const ref = doc(db, "usernames", key);
  const snap = await getDoc(ref);
  return !snap.exists();
}

export async function updateDisplayNameReservation(uid, newDisplayName, previousDisplayName = "") {
  const nextKey = displayNameKey(newDisplayName);
  const prevKey = displayNameKey(previousDisplayName);
  if (!uid || !nextKey) {
    throw new Error("Display name required");
  }
  if (prevKey === nextKey) {
    return;
  }

  const conflictingUid = await findConflictingDisplayNameUid(newDisplayName, uid);
  if (conflictingUid) {
    throw new Error("Display name already taken");
  }

  const nextRef = doc(db, "usernames", nextKey);
  const prevRef = prevKey ? doc(db, "usernames", prevKey) : null;

  await runTransaction(db, async (transaction) => {
    const nextSnap = await transaction.get(nextRef);
    if (nextSnap.exists()) {
      const data = nextSnap.data() || {};
      if (data.uid !== uid) {
        throw new Error("Display name already taken");
      }
    }

    transaction.set(nextRef, { uid, displayName: newDisplayName, updatedAt: new Date().toISOString() }, { merge: true });

    if (prevRef) {
      const prevSnap = await transaction.get(prevRef);
      if (prevSnap.exists()) {
        const data = prevSnap.data() || {};
        if (data.uid === uid) {
          transaction.delete(prevRef);
        }
      }
    }
  });
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
      const maskedEmail = maskEmailValue(data.contactEmail || data.email);
      return {
        uid: docSnap.id,
        ...data,
        maskedEmail,
      };
    })
    .filter((candidate) => {
      if (!candidate?.uid || excluded.has(candidate.uid)) return false;
      if (candidate.excludeFromUserSearch === true) return false;

      const displayName = String(candidate.displayName || candidate.name || "").trim().toLowerCase();
      return displayName.includes(normalizedTerm);
    })
    .sort((a, b) => {
      const aName = String(a.displayName || a.name || "").trim().toLowerCase();
      const bName = String(b.displayName || b.name || "").trim().toLowerCase();

      const score = (name) => {
        if (name === normalizedTerm) return 0;
        if (name.startsWith(normalizedTerm)) return 1;
        return 2;
      };

      return score(aName) - score(bName);
    })
    .slice(0, limit);
}


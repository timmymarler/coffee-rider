// core/firebase/auth.js

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import { auth } from "@config/firebase";
import { ensureUserDocument } from "@firebaseLocal/users";

export async function loginWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);

  // Ensure Firestore profile exists
  await ensureUserDocument(user.uid, user);

  return user;
}

export async function registerWithEmail(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  // Ensure Firestore profile exists
  await ensureUserDocument(user.uid, user);

  return user;
}

export async function logout() {
  return signOut(auth);
}

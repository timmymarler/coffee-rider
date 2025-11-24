import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import { auth } from "@config/firebase";
import { ensureUserDocument } from "@firebaseLocal/users";

export async function loginWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(user.uid);
  return user;
}

export async function registerWithEmail(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(user.uid);
  return user;
}

export async function logout() {
  return signOut(auth);
}

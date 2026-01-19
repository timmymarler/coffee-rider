// core/auth/resetPassword.js
import { auth } from "@config/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export async function resetPassword(email) {
  if (!email) throw new Error("Please enter your email address.");
  await sendPasswordResetEmail(auth, email.trim());
}

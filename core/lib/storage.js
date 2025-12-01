// lib/storage.js
import { storage } from "@/config/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export async function uploadImageAsync(uri, storagePath) {
  if (!uri) return null;

  const response = await fetch(uri);
  const blob = await response.blob();

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);

  return await getDownloadURL(storageRef);
}

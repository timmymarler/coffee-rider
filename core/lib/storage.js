// lib/storage.js
import { storage } from "@/config/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export async function uploadProfileImage(userId, uri) {
  const response = await fetch(uri);
  const blob = await response.blob();

  const storageRef = ref(storage, `profilePhotos/${userId}.jpg`);
  await uploadBytes(storageRef, blob);

  return await getDownloadURL(storageRef);
}

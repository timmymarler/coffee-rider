import { getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "../config/firebase"; // adjust the path if needed
const storage = getStorage(app); // must use the same app

export async function uploadImageAsync(uri, path) {
  try {
    const imageRef = ref(storage, path);

    // Convert file to blob (this works across Expo iOS/Android)
    const response = await fetch(uri);
    const blob = await response.blob();

    await uploadBytes(imageRef, blob, { contentType: "image/jpeg" });
    const downloadURL = await uploadImageAsync(uri, `cafes/${user.uid}/${Date.now()}.jpg`);

    return downloadURL;
  } catch (err) {
    console.error("Upload failed:", err);
    throw err;
  }
}

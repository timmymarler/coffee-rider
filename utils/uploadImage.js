import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as FileSystem from "expo-file-system/legacy";

export async function uploadImageAsync(uri, path) {
  try {
    const storage = getStorage();
    const imageRef = ref(storage, path);

    // Convert file to blob (this works across Expo iOS/Android)
    const response = await fetch(uri);
    const blob = await response.blob();

    await uploadBytes(imageRef, blob, { contentType: "image/jpeg" });
    const downloadURL = await getDownloadURL(imageRef);

    return downloadURL;
  } catch (err) {
    console.error("Upload failed:", err);
    throw err;
  }
}

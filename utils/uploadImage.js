import { getAuth } from "firebase/auth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "../config/firebase";

const storage = getStorage(app);

export async function uploadImageAsync(uri, path) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found");

    const imagePath = path || `profiles/${user.uid}.jpg`;
    const imageRef = ref(storage, imagePath);

    // ✅ Convert local file URI → Blob via fetch
    const response = await fetch(uri);
    const blob = await response.blob();

    // ✅ Upload the blob directly
    await uploadBytes(imageRef, blob, { contentType: "image/jpeg" });

    // ✅ Get the download URL
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  } catch (err) {
    console.error("Upload failed:", err);
    throw err;
  }
}

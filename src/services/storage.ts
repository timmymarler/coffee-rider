// app/src/services/storage.ts
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "../../config/firebase";

async function uriToBlob(uri: string): Promise<Blob> {
  try {
    const res = await fetch(uri);
    return await res.blob();
  } catch {
    // RN fallback
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => reject(new TypeError("Network request failed"));
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) resolve(xhr.response as any);
          else reject(new TypeError(`Status ${xhr.status}`));
        }
      };
      xhr.open("GET", uri);
      xhr.responseType = "blob";
      xhr.send();
    });
  }
}

export async function savePhoto(localUri: string, keyPrefix = "cafes"): Promise<string> {
  if (/^https?:\/\//i.test(localUri)) return localUri;

  const storage = getStorage(app);
  const ext = localUri.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const objectPath = `${keyPrefix}/${filename}`;
  const objectRef = ref(storage, objectPath);

  const blob = await uriToBlob(localUri);

  try {
    const result = await uploadBytes(objectRef, blob, { contentType });
    const url = await getDownloadURL(result.ref);
    return url;
  } catch (e: any) {
    // Drag the actual reason into the light
    let parsed;
    try {
      parsed = e?.customData?.serverResponse
        ? JSON.parse(e.customData.serverResponse)
        : null;
    } catch {}
    console.log("Photo upload error:", {
      code: e?.code,
      message: e?.message,
      bucket: (getStorage(app) as any)?.bucket,
      path: objectPath,
      serverResponse: e?.customData?.serverResponse,
      parsedError: parsed?.error,
    });
    throw e;
  } finally {
    // @ts-ignore
    if (blob && typeof blob.close === "function") blob.close();
  }
}

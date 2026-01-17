import { httpsCallable } from 'firebase/functions';
import { functions } from '@config/firebase';

export async function uploadImage({
  type,        // "place" | "profile"
  placeId,     // required for "place"
  imageBase64,
}) {
  console.log('[uploadImage] Calling function with:', {
    type,
    placeId,
    imageBase64Length: imageBase64?.length || 0,
  });

  try {
    const uploadImageFn = httpsCallable(functions, 'uploadImage');
    const result = await uploadImageFn({
      type,
      placeId,
      imageBase64,
    });

    console.log('[uploadImage] Success:', { path: result.data.path, urlLength: result.data.url?.length });
    return result.data; // { ok, path, url }
  } catch (error) {
    console.log('[uploadImage] Error:', error.message);
    throw error;
  }
}

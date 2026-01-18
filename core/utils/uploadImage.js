import { auth, functions } from '@config/firebase';
import { httpsCallable } from 'firebase/functions';

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
    if (!auth.currentUser) {
      throw new Error('Please sign in before uploading a photo.');
    }

    // Refresh ID token so the callable gets an auth context
    const freshToken = await auth.currentUser.getIdToken(true);

    console.log('[uploadImage] Using user', auth.currentUser.uid, 'token snippet', freshToken?.slice(0, 12));

    const uploadImageFn = httpsCallable(functions, 'uploadImage');
    const result = await uploadImageFn({
      type,
      placeId,
      imageBase64,
      idToken: freshToken,
    });

    console.log('[uploadImage] Success:', { path: result.data.path, urlLength: result.data.url?.length });
    return result.data; // { ok, path, url }
  } catch (error) {
    console.log('[uploadImage] Error:', error.message);
    throw error;
  }
}

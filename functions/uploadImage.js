import * as functions from 'firebase-functions';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const uploadImage = functions.https.onCall(async (data, context) => {
  // httpsCallable automatically populates context.auth with the current user
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const uid = context.auth.uid;
  const { type, imageBase64, placeId } = data;

  // Log input for debugging
  console.log('[uploadImage] Called with:', {
    uid,
    type,
    imageBase64Length: imageBase64?.length || 0,
    placeId,
  });

  // Validate inputs
  if (!type) {
    throw new functions.https.HttpsError('invalid-argument', 'type is required');
  }
  if (!imageBase64) {
    throw new functions.https.HttpsError('invalid-argument', 'imageBase64 is required');
  }
  if (type === 'place' && !placeId) {
    throw new functions.https.HttpsError('invalid-argument', 'placeId is required for place uploads');
  }

  try {
    // Determine the file path
    const path = type === 'profile' 
      ? `profilePhotos/${uid}/avatar.jpg`
      : `placePhotos/${placeId}/${Date.now()}.jpg`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(path);

    // Upload the image
    await file.save(Buffer.from(imageBase64, 'base64'), {
      metadata: { contentType: 'image/jpeg' }
    });

    console.log('[uploadImage] Uploaded file to:', path);

    // Get a signed URL that doesn't expire for 99 years (effectively permanent)
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 99 * 365 * 24 * 60 * 60 * 1000, // 99 years
    });

    console.log('[uploadImage] Generated signed URL:', url);

    return { ok: true, path, url };
  } catch (error) {
    console.error('[uploadImage] Error:', error);
    throw new functions.https.HttpsError('internal', `Upload failed: ${error.message}`);
  }
});
});

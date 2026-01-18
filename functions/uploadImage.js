import admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const uploadImage = functions.https.onCall(async (request, context) => {
  console.log('[uploadImage] Function called');
  
  // Extract the actual data - onCall wraps it
  const data = request.data || request;
  const { type, placeId, imageBase64, idToken } = data;
  
  let uid = null;
  let tokenSource = null;

  // First try context.auth (from Authorization header)
  if (context.auth?.uid) {
    uid = context.auth.uid;
    tokenSource = 'context.auth';
    console.log('[uploadImage] Got uid from context.auth:', uid);
  }
  // Fallback: try to verify the idToken from payload
  else if (idToken) {
    console.log('[uploadImage] No context.auth, attempting to verify payload idToken');
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
      tokenSource = 'payload.idToken';
      console.log('[uploadImage] Successfully verified token from payload, uid:', uid);
    } catch (err) {
      console.error('[uploadImage] Failed to verify provided idToken:', err.message);
      throw new functions.https.HttpsError('unauthenticated', `Token verification failed: ${err.message}`);
    }
  }

  // Final check
  if (!uid) {
    console.error('[uploadImage] No uid found in either context.auth or data.idToken');
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  console.log('[uploadImage] Authentication successful, uid:', uid, 'source:', tokenSource);

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

    // Make file public so we can get a simple public URL
    await file.makePublic();
    
    // Use the bucket name from the actual bucket object
    const actualBucketName = bucket.name;
    
    // Construct the public URL with the correct bucket
    const publicUrl = `https://storage.googleapis.com/${actualBucketName}/${path}`;

    return { ok: true, path, url: publicUrl };
  } catch (error) {
    console.error('[uploadImage] Error:', error);
    throw new functions.https.HttpsError('internal', `Upload failed: ${error.message}`);
  }
});

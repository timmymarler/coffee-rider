import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'us-central1';
const RUNTIME_OPTS = {
  timeoutSeconds: 60,
  memory: '256MB',
};

export const deleteUserAccount = functions
  .region(REGION)
  .runWith(RUNTIME_OPTS)
  .https.onCall(async (data, context) => {
    functions.logger.info('[deleteUserAccount] Invocation received', {
      authed: Boolean(context.auth?.uid),
      requesterUid: context.auth?.uid || null,
      requestedUid: typeof data?.uid === 'string' ? data.uid : null,
    });

    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const requestedUid = typeof data?.uid === 'string' ? data.uid.trim() : '';
    const targetUid = requestedUid || context.auth.uid;

    if (targetUid !== context.auth.uid) {
      try {
        const requester = await admin.auth().getUser(context.auth.uid);
        const isAdmin = requester.customClaims?.admin === true;
        if (!isAdmin) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'You can only delete your own account.'
          );
        }
      } catch (err) {
        if (err instanceof functions.https.HttpsError) {
          throw err;
        }
        functions.logger.error('[deleteUserAccount] Failed admin check', err);
        throw new functions.https.HttpsError('internal', 'Unable to verify permissions.');
      }
    }

    try {
      await admin.auth().deleteUser(targetUid);
      return { ok: true, uid: targetUid };
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        return { ok: true, uid: targetUid, alreadyDeleted: true };
      }

      functions.logger.error('[deleteUserAccount] Failed to delete auth user', {
        targetUid,
        code: err?.code,
        message: err?.message,
      });
      throw new functions.https.HttpsError('internal', 'Failed to remove login account.');
    }
  });

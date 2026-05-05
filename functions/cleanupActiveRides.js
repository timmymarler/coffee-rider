import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'us-central1';
const STALE_MINUTES = 30;

export const cleanupActiveRides = functions
  .region(REGION)
  .pubsub.schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - STALE_MINUTES * 60 * 1000);
    const staleQuery = admin.firestore()
      .collection('activeRides')
      .where('lastUpdated', '<', cutoff);

    const snapshot = await staleQuery.get();
    if (snapshot.empty) {
      return null;
    }

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    functions.logger.info('[cleanupActiveRides] Deleted stale docs:', snapshot.size);
    return null;
  });

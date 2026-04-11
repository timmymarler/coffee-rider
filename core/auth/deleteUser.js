import {
    collection,
    doc,
    getDocs,
    query,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';

const deleteUserAccountCallable = httpsCallable(functions, 'deleteUserAccount');

/**
 * Hard delete a user account and cascade soft-delete their content
 * 1. Hard deletes the user auth account (via Cloud Function)
 * 2. Soft-deletes the user document
 * 3. Soft-deletes all their routes
 * 4. Soft-deletes all their events
 * 5. Soft-deletes all their groups
 * 
 * @param {string} userId - The user ID to delete
 * @param {string} currentUserId - The ID of the user performing the deletion
 * @param {boolean} isAdmin - Whether current user is admin
 * @returns {Promise<void>}
 */
export const deleteUser = async (userId, currentUserId, isAdmin = false) => {
  // Permission check: only the user or admin can delete
  if (userId !== currentUserId && !isAdmin) {
    throw new Error('Unauthorized: Cannot delete another user account');
  }

  try {
    const timestamp = new Date();
    const softDeletePayload = {
      deleted: true,
      deletedAt: timestamp,
      deletedBy: currentUserId,
    };

    // 1. Soft-delete the user document first (must succeed)
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, softDeletePayload);

    // 2. Soft-delete routes/events/groups best-effort.
    // Never allow related-content cleanup failures to block hard account deletion.
    let routeFailures = 0;
    let eventFailures = 0;
    let groupFailures = 0;

    try {
      const routesQuery = query(collection(db, 'routes'), where('createdBy', '==', userId));
      const routesSnapshot = await getDocs(routesQuery);
      const routeResults = await Promise.allSettled(
        routesSnapshot.docs.map((routeDoc) =>
          updateDoc(doc(db, 'routes', routeDoc.id), softDeletePayload)
        )
      );
      routeFailures = routeResults.filter((r) => r.status === 'rejected').length;
    } catch (err) {
      routeFailures += 1;
      console.warn('[deleteUser] Route cleanup query failed:', err?.message || err);
    }

    try {
      const eventsByUserIdQuery = query(collection(db, 'events'), where('userId', '==', userId));
      const eventsByCreatedByQuery = query(collection(db, 'events'), where('createdBy', '==', userId));
      const [eventsByUserIdSnapshot, eventsByCreatedBySnapshot] = await Promise.all([
        getDocs(eventsByUserIdQuery),
        getDocs(eventsByCreatedByQuery),
      ]);

      const eventIds = new Set([
        ...eventsByUserIdSnapshot.docs.map((d) => d.id),
        ...eventsByCreatedBySnapshot.docs.map((d) => d.id),
      ]);
      const eventResults = await Promise.allSettled(
        [...eventIds].map((eventId) => updateDoc(doc(db, 'events', eventId), softDeletePayload))
      );
      eventFailures = eventResults.filter((r) => r.status === 'rejected').length;
    } catch (err) {
      eventFailures += 1;
      console.warn('[deleteUser] Event cleanup query failed:', err?.message || err);
    }

    try {
      const groupsByOwnerIdQuery = query(collection(db, 'groups'), where('ownerId', '==', userId));
      const groupsByCreatedByQuery = query(collection(db, 'groups'), where('createdBy', '==', userId));
      const [groupsByOwnerIdSnapshot, groupsByCreatedBySnapshot] = await Promise.all([
        getDocs(groupsByOwnerIdQuery),
        getDocs(groupsByCreatedByQuery),
      ]);

      const groupIds = new Set([
        ...groupsByOwnerIdSnapshot.docs.map((d) => d.id),
        ...groupsByCreatedBySnapshot.docs.map((d) => d.id),
      ]);
      const groupResults = await Promise.allSettled(
        [...groupIds].map((groupId) => updateDoc(doc(db, 'groups', groupId), softDeletePayload))
      );
      groupFailures = groupResults.filter((r) => r.status === 'rejected').length;
    } catch (err) {
      groupFailures += 1;
      console.warn('[deleteUser] Group cleanup query failed:', err?.message || err);
    }

    if (routeFailures || eventFailures || groupFailures) {
      console.warn('[deleteUser] Partial soft-delete failures', {
        routeFailures,
        eventFailures,
        groupFailures,
      });
    }

    // 5. Best-effort call to hard-delete the auth account.
    // This is intentionally non-blocking so account deactivation can still complete
    // even if auth deletion is unavailable.
    try {
      await deleteUserAccountCallable({ uid: userId });
    } catch (error) {
      console.warn('[deleteUser] Auth identity removal unavailable:', error?.message || error);
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Recover a soft-deleted user account
 * @param {string} userId - The user ID to recover
 * @param {string} currentUserId - The ID of the user performing the recovery
 * @param {boolean} isAdmin - Whether current user is admin
 * @returns {Promise<void>}
 */
export const recoverUser = async (userId, currentUserId, isAdmin = false) => {
  // Permission check: only admin can recover
  if (!isAdmin) {
    throw new Error('Unauthorized: Only admins can recover user accounts');
  }

  try {
    const batch = writeBatch(db);

    // Recover the user document
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      deleted: false,
      deletedAt: null,
      deletedBy: null,
    });

    // Recover all their routes
    const routesQuery = query(
      collection(db, 'routes'),
      where('createdBy', '==', userId),
      where('deleted', '==', true)
    );
    const routesSnapshot = await getDocs(routesQuery);
    routesSnapshot.docs.forEach(docSnap => {
      batch.update(doc(db, 'routes', docSnap.id), {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
      });
    });

    // Recover all their events (support both userId and createdBy).
    const recoverEventsByUserIdQuery = query(
      collection(db, 'events'),
      where('userId', '==', userId),
      where('deleted', '==', true)
    );
    const recoverEventsByCreatedByQuery = query(
      collection(db, 'events'),
      where('createdBy', '==', userId),
      where('deleted', '==', true)
    );
    const [recoverEventsByUserIdSnapshot, recoverEventsByCreatedBySnapshot] = await Promise.all([
      getDocs(recoverEventsByUserIdQuery),
      getDocs(recoverEventsByCreatedByQuery),
    ]);

    const recoverEventIds = new Set([
      ...recoverEventsByUserIdSnapshot.docs.map((d) => d.id),
      ...recoverEventsByCreatedBySnapshot.docs.map((d) => d.id),
    ]);

    recoverEventIds.forEach((eventId) => {
      batch.update(doc(db, 'events', eventId), {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
      });
    });

    // Recover all their groups (support ownerId and createdBy).
    const recoverGroupsByOwnerIdQuery = query(
      collection(db, 'groups'),
      where('ownerId', '==', userId),
      where('deleted', '==', true)
    );
    const recoverGroupsByCreatedByQuery = query(
      collection(db, 'groups'),
      where('createdBy', '==', userId),
      where('deleted', '==', true)
    );
    const [recoverGroupsByOwnerIdSnapshot, recoverGroupsByCreatedBySnapshot] = await Promise.all([
      getDocs(recoverGroupsByOwnerIdQuery),
      getDocs(recoverGroupsByCreatedByQuery),
    ]);

    const recoverGroupIds = new Set([
      ...recoverGroupsByOwnerIdSnapshot.docs.map((d) => d.id),
      ...recoverGroupsByCreatedBySnapshot.docs.map((d) => d.id),
    ]);

    recoverGroupIds.forEach((groupId) => {
      batch.update(doc(db, 'groups', groupId), {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error recovering user:', error);
    throw error;
  }
};

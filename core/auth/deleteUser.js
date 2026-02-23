import {
    collection,
    doc,
    getDocs,
    query,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../../config/firebase';

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
    // Create a batch operation for all updates
    const batch = writeBatch(db);
    const timestamp = new Date();

    // 1. Soft-delete the user document
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      deleted: true,
      deletedAt: timestamp,
      deletedBy: currentUserId,
    });

    // 2. Soft-delete all routes created by this user
    const routesQuery = query(
      collection(db, 'routes'),
      where('createdBy', '==', userId)
    );
    const routesSnapshot = await getDocs(routesQuery);
    routesSnapshot.docs.forEach(docSnap => {
      batch.update(doc(db, 'routes', docSnap.id), {
        deleted: true,
        deletedAt: timestamp,
        deletedBy: currentUserId,
      });
    });

    // 3. Soft-delete all calendar events created by this user
    const eventsQuery = query(
      collection(db, 'calendar_events'),
      where('createdBy', '==', userId)
    );
    const eventsSnapshot = await getDocs(eventsQuery);
    eventsSnapshot.docs.forEach(docSnap => {
      batch.update(doc(db, 'calendar_events', docSnap.id), {
        deleted: true,
        deletedAt: timestamp,
        deletedBy: currentUserId,
      });
    });

    // 4. Soft-delete all groups created by this user
    const groupsQuery = query(
      collection(db, 'groups'),
      where('createdBy', '==', userId)
    );
    const groupsSnapshot = await getDocs(groupsQuery);
    groupsSnapshot.docs.forEach(docSnap => {
      batch.update(doc(db, 'groups', docSnap.id), {
        deleted: true,
        deletedAt: timestamp,
        deletedBy: currentUserId,
      });
    });

    // Commit all changes
    await batch.commit();

    // 5. Call Cloud Function to hard-delete the auth account
    // This happens separately via Firebase Admin SDK
    // The frontend just triggers it and lets backend handle it
    try {
      const response = await fetch(
        'https://us-central1-coffee-rider-app.cloudfunctions.net/deleteUserAccount',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: userId }),
        }
      );
      if (!response.ok) {
        console.error('Error calling deleteUserAccount function:', response.statusText);
      }
    } catch (error) {
      console.error('Error calling Cloud Function to delete auth account:', error);
      // Don't throw here - the Firestore data is already soft-deleted
      // The auth account deletion can be retried separately
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

    // Recover all their events
    const eventsQuery = query(
      collection(db, 'calendar_events'),
      where('createdBy', '==', userId),
      where('deleted', '==', true)
    );
    const eventsSnapshot = await getDocs(eventsQuery);
    eventsSnapshot.docs.forEach(docSnap => {
      batch.update(doc(db, 'calendar_events', docSnap.id), {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
      });
    });

    // Recover all their groups
    const groupsQuery = query(
      collection(db, 'groups'),
      where('createdBy', '==', userId),
      where('deleted', '==', true)
    );
    const groupsSnapshot = await getDocs(groupsQuery);
    groupsSnapshot.docs.forEach(docSnap => {
      batch.update(doc(db, 'groups', docSnap.id), {
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import * as Location from 'expo-location';
import { incMetric } from '../../utils/devMetrics';

/**
 * Hook to manage user's active ride state and real-time location sharing
 * 
 * Location is ONLY shared when:
 * - User explicitly starts a ride
 * - User is a member of the group
 * - Location is ONLY visible to others on the SAME ride in the SAME group
 * 
 * @returns {Object} Active ride state and control functions
 */
export default function useActiveRide(user) {
  const [activeRide, setActiveRide] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const locationSubscriptionRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Normalize Storage URLs - just pass through now that function returns correct bucket
  const normalizeAvatarUrl = useCallback((url) => {
    if (!url) return null;
    // No normalization needed - the uploadImage function now returns correct bucket name
    return url;
  }, []);

  // Listen to user's own active ride document
  useEffect(() => {
    if (!user?.uid) {
      setActiveRide(null);
      return;
    }

    const activeRideRef = doc(db, 'activeRides', user.uid);
    
    const unsubscribe = onSnapshot(
      activeRideRef,
      (snapshot) => {
        incMetric('useActiveRide:snapshot');
        if (snapshot.exists()) {
          setActiveRide({ id: snapshot.id, ...snapshot.data() });
        } else {
          setActiveRide(null);
        }
      },
      (err) => {
        console.error('[useActiveRide] Snapshot error:', err);
        setError(err.message);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Update location periodically when ride is active
  useEffect(() => {
    if (!activeRide || !user?.uid) {
      // Stop location updates if no active ride
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      return;
    }

    console.log('[useActiveRide] Starting location updates for ride:', activeRide.rideId);

    // Start location updates
    const startLocationUpdates = async () => {
      try {
        // Request location permissions if not already granted
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          if (newStatus !== 'granted') {
            console.error('[useActiveRide] Location permission denied');
            setError('Location permission required for ride sharing');
            return;
          }
        }

        // Fetch profile once for name
        const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
        const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
        const userName = profileData.displayName?.trim() || user.displayName || user.email || 'Rider';

        // Watch location with 10-second interval
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000, // Update every 10 seconds
            distanceInterval: 50, // Or when moved 50 meters
          },
          async (location) => {
            const now = Date.now();
            
            // Throttle updates to max once per 5 seconds
            if (now - lastUpdateRef.current < 5000) {
              return;
            }
            
            lastUpdateRef.current = now;

            try {
              const activeRideRef = doc(db, 'activeRides', user.uid);
              
              // Fetch fresh avatar on each update to catch changes
              const freshProfileSnapshot = await getDoc(doc(db, 'users', user.uid));
              const freshProfileData = freshProfileSnapshot.exists() ? freshProfileSnapshot.data() : {};
              const userAvatar = normalizeAvatarUrl(freshProfileData.photoURL || freshProfileData.avatarUrl || user.photoURL || null);
              
              const payload = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                lastLocationUpdate: serverTimestamp(),
              };

              if (userName) payload.userName = userName;
              if (userAvatar) {
                payload.userAvatar = userAvatar;
                console.log('[useActiveRide] Sending avatar:', userAvatar);
              } else {
                console.log('[useActiveRide] No avatar to send');
              }

              await setDoc(activeRideRef, payload, { merge: true });
              
              console.log('[useActiveRide] Location updated:', {
                lat: location.coords.latitude.toFixed(6),
                lng: location.coords.longitude.toFixed(6),
              });
            } catch (err) {
              console.error('[useActiveRide] Error updating location:', err);
            }
          }
        );
      } catch (err) {
        console.error('[useActiveRide] Error starting location updates:', err);
        setError(err.message);
      }
    };

    startLocationUpdates();

    return () => {
      if (locationSubscriptionRef.current) {
        console.log('[useActiveRide] Stopping location updates');
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, [activeRide, user?.uid]);

  /**
   * Start an active ride
   * @param {string} rideId - The route ID from /routes collection
   * @param {string} groupId - The group ID
   * @param {string} routeName - Display name of the route
   */
  const startRide = useCallback(
    async (rideId, groupId, routeName) => {
      if (!user?.uid) {
        setError('User not authenticated');
        return;
      }

      setIsStarting(true);
      setError(null);

      try {
        const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
        const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
              const userName = profileData.displayName?.trim() || user.displayName || user.email || 'Rider';
              const userAvatar = normalizeAvatarUrl(profileData.photoURL || profileData.avatarUrl || user.photoURL || null);

        // Get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const activeRideRef = doc(db, 'activeRides', user.uid);
        const payload = {
          userId: user.uid,
          rideId,
          groupId,
          routeName,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          startedAt: serverTimestamp(),
          lastLocationUpdate: serverTimestamp(),
        };

        if (userName) payload.userName = userName;
        if (userAvatar) payload.userAvatar = userAvatar;

        await setDoc(activeRideRef, payload, { merge: true });

        console.log('[useActiveRide] Started ride:', { rideId, groupId, routeName });
      } catch (err) {
        console.error('[useActiveRide] Error starting ride:', err);
        setError(err.message);
      } finally {
        setIsStarting(false);
      }
    },
    [user]
  );

  /**
   * End the active ride and stop location sharing
   */
  const endRide = useCallback(async () => {
    if (!user?.uid || !activeRide) {
      return;
    }

    try {
      const activeRideRef = doc(db, 'activeRides', user.uid);
      await deleteDoc(activeRideRef);
      console.log('[useActiveRide] Ended ride');
    } catch (err) {
      console.error('[useActiveRide] Error ending ride:', err);
      setError(err.message);
    }
  }, [user?.uid, activeRide]);

  return {
    activeRide,
    isStarting,
    error,
    startRide,
    endRide,
    isRideActive: !!activeRide,
  };
}

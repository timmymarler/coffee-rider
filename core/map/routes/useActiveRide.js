import * as Location from 'expo-location';
import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../../../config/firebase';
import { incMetric } from '../../utils/devMetrics';

// Validate if an active ride record is still fresh
// Rides older than 15 minutes are considered stale (likely abandoned)
const STALE_RIDE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function isRideStale(activeRideData) {
  if (!activeRideData) return true;
  
  // If no lastUpdated timestamp, the ride is in-flight (being created) - NOT stale
  const lastUpdated = activeRideData.lastUpdated?.toMillis?.() || activeRideData.lastUpdated;
  if (!lastUpdated) {
    console.log('[isRideStale] No timestamp found - ride is in-flight, marking as fresh');
    return false; // In-flight rides are NOT stale
  }
  
  const ageMs = Date.now() - lastUpdated;
  const isStale = ageMs > STALE_RIDE_TIMEOUT_MS;
  
  if (isStale) {
    console.log('[isRideStale] Ride is stale - age:', Math.round(ageMs / 1000), 'seconds');
  }
  
  return isStale;
}

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
          const rideData = { id: snapshot.id, ...snapshot.data() };
          // Check if the ride is stale - if so, treat as if it doesn't exist
          // Only delete if it has a valid timestamp AND is older than timeout
          if (isRideStale(rideData)) {
            console.log('[useActiveRide] Detected stale ride record (timestamp:', rideData.lastUpdated, '), clearing it');
            deleteDoc(activeRideRef).catch(err => console.error('Error clearing stale ride:', err));
            setActiveRide(null);
          } else {
            console.log('[useActiveRide] Ride snapshot exists:', rideData.rideId);
            setActiveRide(rideData);
          }
        } else {
          setActiveRide(null);
        }
      },
      (err) => {
        // Ignore permission errors when user is logging out
        if (err.code === 'permission-denied') {
          console.log('[useActiveRide] Permission denied - user likely logging out');
          setActiveRide(null);
          setError(null);
        } else {
          console.error('[useActiveRide] Snapshot error:', err);
          setError(err.message);
        }
      }
    );

    return () => {
      unsubscribe();
    };
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

        // Watch location with 10-second interval for Firestore sharing, 1.5s polling for map
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 1500, // Poll every 1.5 seconds for smooth navigation
            distanceInterval: 5, // 5 meters minimum between updates
          },
          async (location) => {
            const now = Date.now();
            
            // Throttle Firestore updates to max once per 5 seconds (save battery on DB writes)
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
                lastUpdated: serverTimestamp(),
              };

              if (userName) payload.userName = userName;
              if (userAvatar) payload.userAvatar = userAvatar;

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
          lastUpdated: serverTimestamp(),
        };

        if (userName) payload.userName = userName;
        if (userAvatar) payload.userAvatar = userAvatar;

        console.log('[useActiveRide] Writing activeRide document:', payload);
        await setDoc(activeRideRef, payload, { merge: true });
        console.log('[useActiveRide] Successfully wrote activeRide document');

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

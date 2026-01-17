import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { incMetric } from '../../utils/devMetrics';

/**
 * Hook to subscribe to other riders' locations on the same active ride
 * 
 * SECURITY: Only shows locations when:
 * - User has an active ride (myActiveRide provided)
 * - Other riders are on the SAME ride (rideId matches)
 * - Other riders are in the SAME group (groupId matches)
 * 
 * @param {Object} myActiveRide - Current user's active ride object (from useActiveRide)
 * @param {string} userId - Current user's ID (to exclude self)
 * @returns {Array} Array of other riders' locations
 */
export default function useActiveRideLocations(myActiveRide, userId) {
  const [riderLocations, setRiderLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only subscribe if user has an active ride
    if (!myActiveRide || !userId) {
      setRiderLocations([]);
      setLoading(false);
      return;
    }

    const { rideId, groupId } = myActiveRide;

    if (!rideId || !groupId) {
      setRiderLocations([]);
      setLoading(false);
      return;
    }

    console.log('[useActiveRideLocations] Subscribing to ride:', { rideId, groupId });
    setLoading(true);

    // Query for all riders on the same ride in the same group
    const activeRidesQuery = query(
      collection(db, 'activeRides'),
      where('rideId', '==', rideId),
      where('groupId', '==', groupId),
      limit(50) // Limit to 50 concurrent riders
    );

    const unsubscribe = onSnapshot(
      activeRidesQuery,
      (snapshot) => {
        incMetric('useActiveRideLocations:snapshot', 1, 10);
        
        const locations = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          // Exclude self
          if (doc.id !== userId) {
            locations.push({
              id: doc.id,
              ...data,
            });
          }
        });

        incMetric('useActiveRideLocations:docs', locations.length, 10);
        console.log('[useActiveRideLocations] Updated locations:', locations.length);
        
        setRiderLocations(locations);
        setLoading(false);
      },
      (err) => {
        console.error('[useActiveRideLocations] Snapshot error:', err);
        setRiderLocations([]);
        setLoading(false);
      }
    );

    return () => {
      console.log('[useActiveRideLocations] Unsubscribing from ride locations');
      unsubscribe();
    };
  }, [myActiveRide?.rideId, myActiveRide?.groupId, userId]);

  return { riderLocations, loading };
}

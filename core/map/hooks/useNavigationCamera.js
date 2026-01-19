import { useEffect, useRef, useState } from 'react';

/**
 * Hook to manage navigation camera behavior (heading-up mode with rotation)
 * 
 * @param {Object} params
 * @param {boolean} params.isFollowMeEnabled - Whether Follow Me is active
 * @param {Object|null} params.activeRide - Current active ride data
 * @param {Object|null} params.userLocation - Current user location with heading
 * @returns {Object} Navigation camera state
 */
export default function useNavigationCamera({ 
  isFollowMeEnabled, 
  activeRide, 
  userLocation 
}) {
  const [smoothedHeading, setSmoothedHeading] = useState(0);
  const headingHistoryRef = useRef([]);
  
  // Navigation mode is active when Follow Me is enabled OR user is on an active ride
  const isNavigationMode = isFollowMeEnabled || !!activeRide;
  
  // Should rotate map when in navigation mode AND we have a valid heading
  const shouldRotateMap = isNavigationMode && 
    userLocation?.heading !== undefined && 
    userLocation?.heading !== -1 &&
    userLocation?.speed > 0.5; // Only rotate when moving (>0.5 m/s)
  
  useEffect(() => {
    if (!shouldRotateMap || !userLocation?.heading) {
      // Reset heading when not in navigation mode
      if (!isNavigationMode) {
        setSmoothedHeading(0);
        headingHistoryRef.current = [];
      }
      return;
    }
    
    const newHeading = userLocation.heading;
    
    // Add to history buffer (keep last 5 readings for smoothing)
    const history = headingHistoryRef.current;
    history.push(newHeading);
    if (history.length > 5) {
      history.shift();
    }
    
    // Calculate weighted average (more weight to recent readings)
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < history.length; i++) {
      const weight = i + 1; // More recent = higher weight
      const heading = history[i];
      
      // Handle heading wraparound (0° and 360° are same)
      // If we have a big jump, adjust for circular nature
      if (i > 0) {
        const prevHeading = history[i - 1];
        const diff = Math.abs(heading - prevHeading);
        
        if (diff > 180) {
          // Wraparound detected, normalize
          const adjustedHeading = heading < 180 ? heading + 360 : heading;
          weightedSum += adjustedHeading * weight;
        } else {
          weightedSum += heading * weight;
        }
      } else {
        weightedSum += heading * weight;
      }
      
      weightSum += weight;
    }
    
    let averaged = weightedSum / weightSum;
    
    // Normalize back to 0-360 range
    if (averaged >= 360) {
      averaged -= 360;
    }
    
    setSmoothedHeading(averaged);
  }, [shouldRotateMap, userLocation?.heading, userLocation?.speed, isNavigationMode]);
  
  return {
    isNavigationMode,
    shouldRotateMap,
    smoothedHeading,
  };
}

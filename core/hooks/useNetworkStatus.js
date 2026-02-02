import { useEffect, useState } from 'react';

/**
 * Hook to detect if device is online
 * Uses a simple fetch-based approach (no native modules needed)
 * @returns {Object} {isOnline: boolean, isConnected: boolean, type: string}
 */
export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState({
    isOnline: true,
    isConnected: true,
    type: 'unknown',
  });

  useEffect(() => {
    let isMounted = true;
    let checkTimeout = null;

    // Check connectivity by attempting a lightweight fetch
    const checkStatus = async () => {
      try {
        // Try to reach a reliable, lightweight endpoint (1x1 gif)
        const response = await Promise.race([
          fetch('https://www.google.com/favicon.ico', { method: 'HEAD' }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          ),
        ]);

        const isOnline = response.ok || response.status === 0;

        if (isMounted) {
          setNetworkState({
            isOnline,
            isConnected: isOnline,
            type: isOnline ? 'wifi' : 'none',
          });

        }
      } catch (error) {
        // If fetch fails, we're offline
        if (isMounted) {
          setNetworkState({
            isOnline: false,
            isConnected: false,
            type: 'none',
          });
        }
      }

      // Schedule next check in 10 seconds
      if (isMounted) {
        checkTimeout = setTimeout(checkStatus, 10000);
      }
    };

    // Check immediately
    checkStatus();

    return () => {
      isMounted = false;
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, []);

  return networkState;
}

/**
 * Check if currently online
 */
let lastKnownOnlineState = true;

export async function checkNetworkStatus() {
  try {
    const response = await Promise.race([
      fetch('https://www.google.com/favicon.ico', { method: 'HEAD' }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ]);

    const isOnline = response.ok || response.status === 0;
    lastKnownOnlineState = isOnline;
    return isOnline;
  } catch (error) {
    console.warn('[Network] Error checking status:', error);
    lastKnownOnlineState = false;
    return false;
  }
}

export function getLastKnownNetworkStatus() {
  return lastKnownOnlineState;
}

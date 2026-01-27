import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Hook to detect if device is online
 * @returns {Object} {isOnline: boolean, isConnected: boolean, type: string}
 */
export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState({
    isOnline: true,
    isConnected: true,
    type: 'unknown',
  });

  useEffect(() => {
    // Check current state immediately
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable ?? false;

      // Consider online if connected AND internet reachable
      const isOnline = isConnected && isInternetReachable;

      setNetworkState({
        isOnline,
        isConnected,
        type: state.type || 'unknown',
      });

      console.log('[Network]', {
        isOnline,
        isConnected,
        reachable: isInternetReachable,
        type: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return networkState;
}

/**
 * Check if currently online (synchronous check of last known state)
 * For immediate needs - actual state may lag slightly
 */
let lastKnownOnlineState = true;

export async function checkNetworkStatus() {
  try {
    const state = await NetInfo.fetch();
    const isOnline = (state.isConnected ?? false) && (state.isInternetReachable ?? false);
    lastKnownOnlineState = isOnline;
    return isOnline;
  } catch (error) {
    console.warn('[Network] Error checking status:', error);
    return lastKnownOnlineState;
  }
}

export function getLastKnownNetworkStatus() {
  return lastKnownOnlineState;
}

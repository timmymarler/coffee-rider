import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

// Color palette for users
const USER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Light Blue
  '#F8B88B', // Peach
  '#52B788', // Green
];

/**
 * Get a consistent color for a user based on their ID
 */
function getUserColor(userId, index) {
  if (!userId) return USER_COLORS[index % USER_COLORS.length];
  
  // Generate a consistent color based on user ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

/**
 * Mini map component to show group member locations
 * Automatically zooms to fit all riders in the viewport
 */
export default function MiniMap({
  riderLocations = [],
  userLocation = null,
  routeCoords = [],
  styles: containerStyles = {},
  mapStyleDark = null,
  mapStyleLight = null,
  colorScheme = 'light',
  isModal = false,
}) {
  const theme = useTheme();
  const miniMapRef = useRef(null);
  const zoomDebounceRef = useRef(null);

  // Calculate bounds to fit all riders, user, and full route (but exclude route for fullscreen modal)
  const initialRegion = useMemo(() => {
    const allPoints = [
      ...(userLocation ? [userLocation] : []),
      ...riderLocations.map(r => ({ latitude: r.latitude, longitude: r.longitude })),
      ...(isModal ? [] : routeCoords), // Exclude route for fullscreen modal so it focuses on riders only
    ];

    if (allPoints.length === 0) {
      return {
        latitude: 51.5074,
        longitude: -0.1278,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    const lats = allPoints.map(p => p.latitude);
    const lngs = allPoints.map(p => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = (maxLat - minLat) * 1.3; // 30% padding
    const lngDelta = (maxLng - minLng) * 1.3;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    };
  }, [userLocation, riderLocations, routeCoords, isModal]);

  const zoomLevelRef = useRef(null);

  // Smooth zoom to fit when riders or route changes (debounced to prevent jitter)
  useEffect(() => {
    if (!miniMapRef.current || !userLocation) return;
    
    // Clear any pending zoom updates
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }

    // Debounce zoom to prevent jittery behavior while riders are moving
    zoomDebounceRef.current = setTimeout(() => {
      // Calculate optimal zoom based on rider spread
      let zoom = 16; // default
      
      if (riderLocations.length > 0) {
        const allRiders = [userLocation, ...riderLocations];
        let minLat = allRiders[0].latitude;
        let maxLat = allRiders[0].latitude;
        let minLng = allRiders[0].longitude;
        let maxLng = allRiders[0].longitude;

        allRiders.forEach(rider => {
          minLat = Math.min(minLat, rider.latitude);
          maxLat = Math.max(maxLat, rider.latitude);
          minLng = Math.min(minLng, rider.longitude);
          maxLng = Math.max(maxLng, rider.longitude);
        });

        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        const maxSpan = Math.max(latSpan, lngSpan);
        // Much tighter padding for fullscreen modal, slightly looser for small view
        const padding = isModal ? 0.00008 : 0.0005; // fullscreen needs much tighter zoom
        const totalSpan = maxSpan + padding;
        // Allow zoom up to 20 for fullscreen modal to really zoom in on riders
        const maxZoom = isModal ? 20 : 19;
        zoom = Math.max(14, Math.min(maxZoom, 17 - Math.log2(totalSpan * 111000)));
      }

      // Only animate zoom if it's significantly different
      const zoomDiff = zoomLevelRef.current !== null ? Math.abs(zoom - zoomLevelRef.current) : 0;
      if (zoomDiff > 0.5) {
        zoomLevelRef.current = zoom;
        const heading = userLocation.heading !== undefined && userLocation.heading !== -1 ? userLocation.heading : 0;
        
        // iOS has issues with zoom in animateCamera, use fitToCoordinates instead
        if (Platform.OS === 'ios') {
          const allRiders = [userLocation, ...riderLocations];
          const edgePadding = isModal ? { top: 40, right: 40, bottom: 40, left: 40 } : { top: 50, right: 50, bottom: 50, left: 50 };
          miniMapRef.current?.fitToCoordinates(
            allRiders.map(r => ({ latitude: r.latitude, longitude: r.longitude })),
            { edgePadding, animated: true }
          );
        } else {
          miniMapRef.current?.animateCamera({
            center: { latitude: userLocation.latitude, longitude: userLocation.longitude },
            heading: heading,
            pitch: 50,
            zoom: Math.floor(zoom),
            duration: 300
          });
        }
      }
    }, 500); // Longer debounce for zoom changes

    return () => {
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
      }
    };
  }, [riderLocations.length, isModal]);

  // Continuous camera updates during Follow Me - non-animated to keep dot stationary
  useEffect(() => {
    if (!miniMapRef.current || !userLocation) return;

    const heading = userLocation.heading !== undefined && userLocation.heading !== -1 ? userLocation.heading : 0;
    const zoom = zoomLevelRef.current || 16;

    // Use setCamera (non-animated) for continuous updates to prevent dot from appearing to move
    miniMapRef.current?.setCamera({
      center: { latitude: userLocation.latitude, longitude: userLocation.longitude },
      heading: heading,
      pitch: 50,
      zoom: Math.floor(zoom),
    });
  }, [userLocation?.latitude, userLocation?.longitude, userLocation?.heading]);

  return (
    <View style={[styles.container, containerStyles]}>
      <MapView
        ref={miniMapRef}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={colorScheme === 'dark' ? mapStyleDark : mapStyleLight}
        zoomEnabled={false}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        showsMyLocationButton={false}
        showsUserLocation={false}
      >
        {/* Route polyline - background */}
        {routeCoords.length > 1 && (
          <>
            <Polyline
              coordinates={routeCoords}
              strokeWidth={2}
              strokeColor="#1565C0"
              zIndex={100}
            />
            {/* Route polyline - bright overlay */}
            <Polyline
              coordinates={routeCoords}
              strokeWidth={1.5}
              strokeColor="#42A5F5"
              zIndex={101}
            />
          </>
        )}

        {/* User location - simple colored circle */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={200}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.userLocationMarker, { backgroundColor: theme.colors.primary }]} />
              <View style={styles.labelBubble}>
                <Text style={styles.labelText}>You</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Other riders - consistent sized dots with colors and labels */}
        {riderLocations.map((rider, index) => (
          <Marker
            key={`rider-${rider.id}`}
            coordinate={{
              latitude: rider.latitude,
              longitude: rider.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={300}
          >
            <View style={styles.markerContainer}>
              <View 
                style={[
                  styles.riderMarker, 
                  { backgroundColor: getUserColor(rider.id, index) }
                ]} 
              />
              <View style={styles.labelBubble}>
                <Text style={styles.labelText} numberOfLines={1}>
                  {rider.userName || `Rider ${index + 1}`}
                </Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Rider count badge */}
      {riderLocations.length > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.colors.accentMid }]}>
          <MaterialCommunityIcons
            name="account-multiple"
            size={16}
            color={theme.colors.primaryDark}
          />
          <Text style={[styles.badgeText, { color: theme.colors.primaryDark }]}>
            {riderLocations.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  userLocationMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  riderMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerContainer: {
    alignItems: 'center',
    gap: 4,
  },
  labelBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 70,
  },
  labelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

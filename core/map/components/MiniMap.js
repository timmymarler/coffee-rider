import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useMemo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
 */
export default function MiniMap({
  riderLocations = [],
  userLocation = null,
  routeCoords = [],
  styles: containerStyles = {},
  colorScheme = 'light',
  isModal = false,
}) {
  const theme = useTheme();

  // Keep user in center, update region every 30s to fit all riders
  const mapRef = useRef(null);
  const lastFitRef = useRef(Date.now());

  // Initial region: center on user or fallback
  const initialRegion = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return {
      latitude: 51.5074,
      longitude: -0.1278,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [userLocation]);

  // Effect: every 30s, fit all riders in view (with user centered)
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    const interval = setInterval(() => {
      if (!mapRef.current) return;
      const allPoints = [userLocation, ...riderLocations.map(r => ({ latitude: r.latitude, longitude: r.longitude }))];
      if (allPoints.length < 2) return;
      // Calculate bounds
      const lats = allPoints.map(p => p.latitude);
      const lngs = allPoints.map(p => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: Math.max((maxLat - minLat) * 1.3, 0.02),
        longitudeDelta: Math.max((maxLng - minLng) * 1.3, 0.02),
      }, 1000);
      lastFitRef.current = Date.now();
    }, 30000);
    return () => clearInterval(interval);
  }, [userLocation, riderLocations]);


  return (
    <View style={[styles.container, containerStyles]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={null}
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
              <View style={[styles.labelBubble, { marginTop: 2, alignSelf: 'center', maxWidth: 70 }]}> 
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
              <View style={[styles.labelBubble, { marginTop: 2, alignSelf: 'center', maxWidth: 70 }]}> 
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

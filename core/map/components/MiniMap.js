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

  // Effect: fit all markers (user + riders) with padding for name bubbles every 30s, not on every update
  useEffect(() => {
    if (!mapRef.current) return;
    const fitAll = () => {
      const coords = [];
      if (userLocation) {
        coords.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
      }
      riderLocations.forEach(rider => {
        coords.push({ latitude: rider.latitude, longitude: rider.longitude });
      });
      if (coords.length > 1 && mapRef.current) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 40, right: 80, bottom: 40, left: 80 },
          animated: true,
        });
      }
    };
    // Initial fit on mount
    fitAll();
    // Refit every 30s
    const interval = setInterval(fitAll, 30000);
    return () => clearInterval(interval);
  }, [userLocation, riderLocations.length]);


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
        // No onMapReady fit; handled by effect above
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

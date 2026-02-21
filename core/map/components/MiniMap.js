import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';

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
}) {
  const theme = useTheme();
  const miniMapRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Calculate bounds to fit all riders and user
  const initialRegion = useMemo(() => {
    const allPoints = [
      ...(userLocation ? [userLocation] : []),
      ...riderLocations.map(r => ({ latitude: r.latitude, longitude: r.longitude })),
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

    const latDelta = (maxLat - minLat) * 1.15; // 15% padding for closer zoom
    const lngDelta = (maxLng - minLng) * 1.15;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.003),
      longitudeDelta: Math.max(lngDelta, 0.003),
    };
  }, [userLocation, riderLocations]);

  // Zoom to fit when riders change - throttled to 15 seconds for battery optimization
  useEffect(() => {
    const now = Date.now();
    if (miniMapRef.current && (riderLocations.length > 0 || userLocation) && now - lastUpdateRef.current > 15000) {
      miniMapRef.current.animateToRegion(initialRegion, 500);
      lastUpdateRef.current = now;
    }
  }, [riderLocations.length, userLocation?.latitude, userLocation?.longitude]);

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

        {/* User current location - blue dot */}
        {userLocation && (
          <Circle
            center={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            radius={20}
            fillColor="rgba(33, 150, 243, 0.4)"
            strokeColor="#2196F3"
            strokeWidth={2.5}
            zIndex={102}
          />
        )}

        {/* Other riders - simple colored dots */}
        {riderLocations.map((rider) => (
          <Circle
            key={`rider-${rider.id}`}
            center={{
              latitude: rider.latitude,
              longitude: rider.longitude,
            }}
            radius={22}
            fillColor="rgba(255, 152, 0, 0.5)"
            strokeColor="#FF9800"
            strokeWidth={2}
            zIndex={300}
          />
        ))}}
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

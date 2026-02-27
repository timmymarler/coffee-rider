import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

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

    const latDelta = (maxLat - minLat) * 1.3; // 30% padding
    const lngDelta = (maxLng - minLng) * 1.3;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    };
  }, [userLocation, riderLocations]);

  // Zoom to fit when riders change
  useEffect(() => {
    if (miniMapRef.current && (riderLocations.length > 0 || userLocation)) {
      miniMapRef.current.animateToRegion(initialRegion, 500);
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

        {/* User location - simple colored circle */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={200}
          >
            <View style={[styles.userLocationMarker, { backgroundColor: theme.colors.primary }]} />
          </Marker>
        )}

        {/* Other riders - simple colored circles */}
        {riderLocations.map((rider) => (
          <Marker
            key={`rider-${rider.id}`}
            coordinate={{
              latitude: rider.latitude,
              longitude: rider.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={300}
          >
            <View style={[styles.riderMarker, { backgroundColor: theme.colors.accentLight }]} />
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
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  riderMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
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

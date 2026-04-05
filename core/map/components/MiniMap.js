import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

function isFiniteCoord(coord) {
  return (
    coord &&
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude)
  );
}

function normalizeCoord(coord) {
  if (!coord) return null;
  const latitude = coord.latitude ?? coord.lat;
  const longitude = coord.longitude ?? coord.lng;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const dLat = (b.latitude - a.latitude) * 111320;
  const metersPerLng = (40075000 * Math.cos((a.latitude * Math.PI) / 180)) / 360;
  const dLng = (b.longitude - a.longitude) * metersPerLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function offsetByMeters(coord, meters, angleDeg) {
  if (!coord || !Number.isFinite(meters) || !Number.isFinite(angleDeg)) return coord;
  const radians = (angleDeg * Math.PI) / 180;
  const dNorth = Math.cos(radians) * meters;
  const dEast = Math.sin(radians) * meters;

  const dLat = dNorth / 111320;
  const metersPerLng = (40075000 * Math.cos((coord.latitude * Math.PI) / 180)) / 360;
  const dLng = metersPerLng ? (dEast / metersPerLng) : 0;

  return {
    latitude: coord.latitude + dLat,
    longitude: coord.longitude + dLng,
  };
}

/**
 * Mini map component to show group member locations
 */
export default function MiniMap({
  riderLocations = [],
  userLocation = null,
  routeCoords = [],
  destination = null,
  waypoints = [],
  showDestination = true,
  showWaypoints = false,
  styles: containerStyles = {},
  colorScheme = 'light',
  isModal = false,
}) {
  const theme = useTheme();
  const markerTracksViewChanges = Platform.OS !== 'ios';

  const mapRef = useRef(null);
  const fitTimeoutRef = useRef(null);
  const hasFittedRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);

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

  const participantCoordinates = useMemo(() => {
    const coords = [];
    if (isFiniteCoord(userLocation)) {
      coords.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    }
    riderLocations.forEach((rider) => {
      if (isFiniteCoord(rider)) {
        coords.push({ latitude: rider.latitude, longitude: rider.longitude });
      }
    });
    return coords;
  }, [userLocation, riderLocations]);

  const routeOverviewCoordinates = useMemo(() => {
    if (!Array.isArray(routeCoords) || routeCoords.length === 0) return [];
    if (routeCoords.length <= 80) {
      return routeCoords.filter(isFiniteCoord);
    }

    const sampled = [];
    const sampleEvery = Math.max(1, Math.ceil(routeCoords.length / 60));
    for (let i = 0; i < routeCoords.length; i += sampleEvery) {
      const coord = routeCoords[i];
      if (isFiniteCoord(coord)) sampled.push(coord);
    }

    const first = routeCoords[0];
    const last = routeCoords[routeCoords.length - 1];
    if (isFiniteCoord(first)) sampled.unshift(first);
    if (isFiniteCoord(last)) sampled.push(last);
    return sampled;
  }, [routeCoords]);

  const destinationCoord = useMemo(() => normalizeCoord(destination), [destination]);

  const waypointCoordinates = useMemo(() => {
    if (!Array.isArray(waypoints) || waypoints.length === 0) return [];
    const normalized = [];
    waypoints.forEach((wp) => {
      const coord = normalizeCoord(wp);
      if (coord) normalized.push(coord);
    });
    return normalized;
  }, [waypoints]);

  const visibleWaypointCoordinates = useMemo(() => {
    return showWaypoints ? waypointCoordinates : [];
  }, [showWaypoints, waypointCoordinates]);

  const userCoord = useMemo(() => normalizeCoord(userLocation), [userLocation]);

  const renderRiders = useMemo(() => {
    const adjusted = [];

    riderLocations.forEach((rider, index) => {
      const coord = normalizeCoord(rider);
      if (!coord) return;

      let renderedCoord = coord;
      const nearUser = userCoord && distanceMeters(coord, userCoord) < 6;
      const baseAngle = ((index * 97) % 360);

      if (nearUser) {
        renderedCoord = offsetByMeters(renderedCoord, 9, baseAngle);
      }

      for (let i = 0; i < adjusted.length; i += 1) {
        if (distanceMeters(renderedCoord, adjusted[i].coordinate) < 4) {
          renderedCoord = offsetByMeters(renderedCoord, 7, baseAngle + 35);
          break;
        }
      }

      adjusted.push({
        ...rider,
        renderIndex: index,
        coordinate: renderedCoord,
      });
    });

    return adjusted;
  }, [riderLocations, userCoord]);

  const fitCoordinates = useMemo(() => {
    const destinationPoints = showDestination && destinationCoord ? [destinationCoord] : [];
    return [
      ...routeOverviewCoordinates,
      ...participantCoordinates,
      ...destinationPoints,
      ...visibleWaypointCoordinates,
    ];
  }, [routeOverviewCoordinates, participantCoordinates, showDestination, destinationCoord, visibleWaypointCoordinates]);

  const fitSignature = useMemo(() => {
    if (fitCoordinates.length === 0) return 'empty';
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    fitCoordinates.forEach((c) => {
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
    });

    return [
      fitCoordinates.length,
      minLat.toFixed(5),
      maxLat.toFixed(5),
      minLng.toFixed(5),
      maxLng.toFixed(5),
      isModal ? 'modal' : 'inline',
    ].join(':');
  }, [fitCoordinates, isModal]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady || fitCoordinates.length < 2) return;

    if (fitTimeoutRef.current) {
      clearTimeout(fitTimeoutRef.current);
    }

    fitTimeoutRef.current = setTimeout(() => {
      if (!mapRef.current) return;

      mapRef.current.fitToCoordinates(fitCoordinates, {
        edgePadding: isModal
          ? { top: 96, right: 72, bottom: 104, left: 72 }
          : { top: 42, right: 42, bottom: 52, left: 42 },
        animated: isModal && hasFittedRef.current,
      });

      hasFittedRef.current = true;
    }, 120);

    return () => {
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
        fitTimeoutRef.current = null;
      }
    };
  }, [fitSignature, fitCoordinates, isModal, isMapReady]);

  useEffect(() => {
    // Each mount/mode switch should allow a fresh first-fit for this map instance.
    hasFittedRef.current = false;
  }, [isModal]);


  return (
    <View style={[styles.container, containerStyles]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={null}
        onMapReady={() => setIsMapReady(true)}
        zoomEnabled={isModal}
        scrollEnabled={isModal}
        pitchEnabled={false}
        rotateEnabled={isModal}
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
            tracksViewChanges={markerTracksViewChanges}
          >
            <View style={styles.markerContainer} collapsable={false}>
              <View style={[styles.labelBubble, styles.markerLabel]}> 
                <Text style={styles.labelText}>You</Text>
              </View>
              <View style={[styles.userLocationMarker, { backgroundColor: theme.colors.primary }]} />
            </View>
          </Marker>
        )}

        {/* Destination marker */}
        {showDestination && destinationCoord && (
          <Marker
            coordinate={destinationCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={260}
            tracksViewChanges={markerTracksViewChanges}
          >
            <View style={styles.destinationMarker}>
              <MaterialCommunityIcons name="map-marker" size={12} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Waypoint markers (modal/fullscreen only) */}
        {visibleWaypointCoordinates.map((coord, idx) => (
          <Marker
            key={`waypoint-${idx}-${coord.latitude}-${coord.longitude}`}
            coordinate={coord}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={255}
            tracksViewChanges={markerTracksViewChanges}
          >
            <View style={styles.waypointMarker} />
          </Marker>
        ))}

        {/* Other riders - consistent sized dots with colors and labels */}
        {renderRiders.map((rider, index) => (
          <Marker
            key={`rider-${rider.id}`}
            coordinate={rider.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={300}
            tracksViewChanges={markerTracksViewChanges}
          >
            <View style={styles.markerContainer} collapsable={false}>
              <View style={[styles.labelBubble, styles.markerLabel]}> 
                <Text style={styles.labelText} numberOfLines={1}>
                  {rider.userName || `Rider ${rider.renderIndex + 1}`}
                </Text>
              </View>
              <View 
                style={[
                  styles.riderMarker, 
                  { backgroundColor: getUserColor(rider.id, rider.renderIndex) }
                ]} 
              />
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
  destinationMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markerContainer: {
    alignItems: 'center',
    minWidth: 72,
    minHeight: 38,
  },
  markerLabel: {
    marginBottom: 3,
    alignSelf: 'center',
    maxWidth: 72,
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

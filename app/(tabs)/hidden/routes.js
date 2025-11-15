import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import haversine from "haversine-distance";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { auth, db, GOOGLE_API_KEY } from "../../../config/firebase";

const distanceMiles = (start, end) => {
  if (!start || !end) return 0;
  const meters = haversine(
    { lat: start.latitude, lon: start.longitude },
    { lat: end.latitude, lon: end.longitude }
  );
  return meters * 0.000621371;
};

export default function RoutesScreen() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [nearestCafes, setNearestCafes] = useState({});
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const routesRef = collection(db, "users", user.uid, "favouriteRoutes");
    const unsubscribeRoutes = onSnapshot(routesRef, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRoutes(list);
    });

    const cafesRef = collection(db, "cafes");
    const unsubscribeCafes = onSnapshot(cafesRef, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCafes(list);
    });

    return () => {
      unsubscribeRoutes();
      unsubscribeCafes();
    };
  }, []);

  useEffect(() => {
    if (!routes.length || !cafes.length) return;

    const nearest = {};
    routes.forEach((route) => {
      let nearestCafe = null;
      let minDist = Infinity;
      cafes.forEach((cafe) => {
        const cafeCoords = cafe.coords;
        if (!cafeCoords) return;
        const d = Math.hypot(
          route.end.latitude - cafeCoords.latitude,
          route.end.longitude - cafeCoords.longitude
        );
        if (d < minDist) {
          minDist = d;
          nearestCafe = cafe;
        }
      });
      nearest[route.name] = nearestCafe?.name || "Unknown café";
    });
    setNearestCafes(nearest);
  }, [routes, cafes]);

  const handleSelectRoute = async (route) => {
    setSelectedRoute(route);
    setLoading(true);
    try {
      const waypointString = route.waypoints
        ?.map((w) => `${w.latitude},${w.longitude}`)
        .join("|");
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${route.start.latitude},${route.start.longitude}&destination=${route.end.latitude},${route.end.longitude}&key=${GOOGLE_API_KEY}&waypoints=${waypointString}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.length) {
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoords(points);
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(points, {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }, 300);
      }
    } catch (err) {
      console.error("Directions fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (route) => {
    const start = `${route.start.latitude},${route.start.longitude}`;
    const end = `${route.end.latitude},${route.end.longitude}`;
    const waypoints = route.waypoints
      ?.map((w) => `${w.latitude},${w.longitude}`)
      .join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${end}&waypoints=${waypoints}&travelmode=driving`;
    Linking.openURL(url);
  };

const handleEdit = () => {
  if (!selectedRoute) return;
  router.push({
    pathname: "/(tabs)/map",
    params: {
      loadRoute: JSON.stringify(selectedRoute)
    }
  });
};

  function decodePolyline(encoded) {
    const points = [];
    let index = 0,
      lat = 0,
      lng = 0;
    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  }

  return (
    <>
    <View style={styles.container}>
      <View style={styles.listContainer}>
        <FlatList
          data={routes}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => {
            const miles = distanceMiles(item.start, item.end).toFixed(1);
            return (
              <TouchableOpacity
                style={[
                  styles.routeItem,
                  selectedRoute?.name === item.name && styles.routeItemSelected,
                ]}
                onPress={() => handleSelectRoute(item)}
              >
                <Text style={styles.routeName}>{item.name}</Text>
                <Text style={styles.routeDetails}>
                  {`To: ${nearestCafes[item.name] || "Unknown café"} • ${miles} mi`}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#666", marginTop: 20 }}>
              No saved routes yet
            </Text>
          }
        />
      </View>

      <View style={styles.mapContainer}>
        {loading && (
          <ActivityIndicator
            size="large"
            color="#007aff"
            style={styles.loadingOverlay}
          />
        )}

        <MapView
          ref={mapRef}
          style={styles.mapContainer}
          onMapReady={() => setIsMapReady(true)}
        >
          {selectedRoute && (
            <>
              <Polyline
                coordinates={routeCoords}
                strokeColor="#007AFF"
                strokeWidth={5}
              />
              <Marker
                coordinate={selectedRoute.start}
                title="Start"
                pinColor="#0091ff"
              />
              <Marker
                coordinate={selectedRoute.end}
                title={nearestCafes[selectedRoute.name] || "Destination"}
                pinColor="darkorange"
              />
              {selectedRoute.waypoints?.map((wp, i) => (
                <Marker
                  key={i}
                  coordinate={wp}
                  title={`Waypoint ${i + 1}`}
                  pinColor="#40CFFF"
                />
              ))}
            </>
          )}
        </MapView>

        {selectedRoute && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={() => handleNavigate(selectedRoute)}
            >
              <Text style={styles.buttonText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row" },
  listContainer: {
    width: "40%",
    backgroundColor: "#f8f8f8",
    borderRightWidth: 1,
    borderColor: "#ccc",
  },
  mapContainer: { flex: 1 },
  routeItem: { padding: 12, borderBottomWidth: 1, borderColor: "#ddd" },
  routeItemSelected: { backgroundColor: "#e0f7fa" },
  routeName: { fontSize: 16, fontWeight: "bold" },
  routeDetails: { fontSize: 14, color: "#666" },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  editButton: {
    flex: 1,
    backgroundColor: "#555",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8,
  },
  navigateButton: {
    flex: 1,
    backgroundColor: "#007aff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    marginLeft: 8,
  },
});

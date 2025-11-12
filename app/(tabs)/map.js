import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import polyline from "@mapbox/polyline";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import ClusteredMapView from "react-native-map-clustering";
import { Marker, Polyline } from "react-native-maps";

import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase.js";
import { saveFavouriteRoute } from "../../utils/favouriteRoutes";
import { getRoute } from "../../utils/getRoute";

const apiKey = Constants.expoConfig.extra.googleMapsApiKey;

// Reverse geocoding helper
// Reverse geocoding helper with smarter filtering
async function getAddressFromCoords(lat, lng, apiKey) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.results.length) {
      console.warn("Geocode failed:", data.status);
      return null;
    }

    const result = data.results[0];
    const comps = result.address_components || [];

    const routeComp = comps.find((c) => c.types.includes("route"));
    const localityComp = comps.find((c) =>
      c.types.includes("locality") || c.types.includes("postal_town")
    );
    const adminComp = comps.find((c) =>
      c.types.includes("administrative_area_level_2") ||
      c.types.includes("administrative_area_level_1")
    );
    const countryComp = comps.find((c) => c.types.includes("country"));

    if (routeComp && localityComp) return `${routeComp.short_name}, ${localityComp.long_name}`;
    if (routeComp && adminComp) return `${routeComp.short_name}, ${adminComp.long_name}`;
    if (routeComp && countryComp) return `${routeComp.short_name}, ${countryComp.long_name}`;
    if (localityComp && countryComp) return `${localityComp.long_name}, ${countryComp.long_name}`;
    return result.formatted_address || null;
  } catch (err) {
    console.error("Reverse-geocode failed:", err);
    return null;
  }
}


export default function MapPage() {
  // State
  const [cafes, setCafes] = useState([]);
  const [selectedCafe, setSelectedCafe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRegion, setUserRegion] = useState(null);
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState({ overall: 0, service: 0, value: 0 });
  const [suppressAvgUpdate, setSuppressAvgUpdate] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [facilityFilters, setFacilityFilters] = useState({
    offRoadParking: false,
    bikes: false,
    scooters: false,
    cyclists: false,
    cars: false,
  });
  const [routeVisible, setRouteVisible] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState("");

  // Refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);
  const lastSelectedCafeRef = useRef(null);

const handleClearRoute = () => {
  setRouteCoords([]);      // clear route line
  setWaypoints([]);        // remove all dropped waypoints
  setSelectedCafe(null);   // close any café card
  setRouteVisible(false);  // hide floating buttons
  lastSelectedCafeRef.current = null; // reset stored café
};

  // ROUTING -----------------------------------------------------------------
async function handleRoutePress() {
  console.log("Route button pressed");

  if (!userRegion) {
    console.warn("userRegion missing");
    return;
  }
  if (!selectedCafe?.coords) {
    console.warn("selectedCafe missing");
    return;
  }

  const startLat = userRegion.latitude;
  const startLng = userRegion.longitude;
  const endLat = selectedCafe.coords.latitude;
  const endLng = selectedCafe.coords.longitude;

  console.log("Start:", startLat, startLng, "End:", endLat, endLng);

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&key=${apiKey}`;

  console.log("Directions URL:", url);

 try {
  const response = await fetch(url);
  const data = await response.json();

  if (!data.routes || !data.routes.length) {
    console.warn("No routes found:", data.status, data.error_message);
    return;
  }

  const encoded = data.routes[0].overview_polyline?.points;
  if (!encoded) {
    console.warn("No polyline data in response");
    return;
  }

  const points = polyline.decode(encoded)
    .map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
    .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));

  if (!points.length) {
    console.warn("Decoded polyline empty or invalid");
    return;
  }

  setRouteCoords(points);
  lastSelectedCafeRef.current = selectedCafe;
  setRouteVisible(true);

  if (mapRef.current) {
    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 100, right: 80, bottom: 100, left: 80 },
      animated: true,
    });
  }
} catch (err) {
  console.error("Directions fetch failed:", err);
}
}

  async function showRoute(cafe) {
    if (!userRegion || !cafe?.coords) return;
    const coords = await getRoute(userRegion, cafe.coords);
    setRouteCoords(coords);
  }

async function recalcRouteWithWaypoints(waypoints) {
  if (!userRegion || !lastSelectedCafeRef.current?.coords) {
    console.warn("Missing route data during recalculation");
    return [];
  }

  const start = `${userRegion.latitude},${userRegion.longitude}`;
  const end = `${lastSelectedCafeRef.current.coords.latitude},${lastSelectedCafeRef.current.coords.longitude}`;

  // Build the waypoint string (Google expects “lat,lng|lat,lng|...”)
  const wpString = waypoints
    .map((wp) => `${wp.latitude},${wp.longitude}`)
    .join("|");

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${start}&destination=${end}&waypoints=${wpString}&key=${apiKey}`;
  console.log("Recalc URL:", url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      console.warn("Recalc failed:", data.status, data.error_message);
      return [];
    }

    const encoded = data.routes[0].overview_polyline?.points;
    if (!encoded) return [];

    const points = polyline.decode(encoded).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));

    return points;
  } catch (err) {
    console.error("Route recalculation failed:", err);
    return [];
  }
}

  // Handle tapping on the map to add/remove waypoints
// Track touch time globally
let pressStart = 0;

function handleTouchStart() {
  pressStart = Date.now();
}

// Find existing waypoint by coordinates (within ~10m)
function findCachedWaypoint(lat, lng, existingWaypoints) {
  return existingWaypoints.find((wp) => {
    const dist =
      Math.sqrt(
        Math.pow(wp.latitude - lat, 2) + Math.pow(wp.longitude - lng, 2)
      ) * 111_000; // degrees → metres
    return dist < 10; // treat <10m as same spot
  });
}


async function handleMapPress(e) {
  // Ignore map taps when a café card is open
  if (selectedCafe) return;

  // Ignore marker or route taps
  if (e.nativeEvent?.action === "marker-press") return;

  const { coordinate } = e.nativeEvent;
  if (!coordinate) return;

  const lat = coordinate.latitude;
  const lng = coordinate.longitude;

  // Only add waypoints if a route is active and café exists
  if (!routeVisible || !lastSelectedCafeRef.current) {
    console.warn("Ignoring tap: no active route");
    return;
  }

  // Check if this location already exists
  const existing = findCachedWaypoint(lat, lng, waypoints);

  let newWaypoint;
  if (existing) {
    newWaypoint = existing;
  } else {
    const address = await getAddressFromCoords(lat, lng);
    newWaypoint = {
      latitude: lat,
      longitude: lng,
      address: address || null,
      name: address ? address.split(",")[0] : null,
    };
  }

  const updated = [...waypoints, newWaypoint];
  setWaypoints(updated);

  try {
    const newCoords = await recalcRouteWithWaypoints(updated);
    if (newCoords?.length) {
      setRouteCoords(newCoords);
    } else {
      console.warn("Route recalculation returned no points");
    }
  } catch (err) {
    console.warn("Route recalculation failed:", err);
  }
}

// Get the user's favourite routes
function handleSaveRoute() {
  if (!userRegion || !lastSelectedCafeRef.current) return;
  setShowSaveModal(true);
}


  // DATA FETCHING -----------------------------------------------------------
  useEffect(() => {
    let unsubSnapshot = null;

    const unsubAuth = onAuthStateChanged(auth, (usr) => {
      setUser(usr);

      unsubSnapshot = onSnapshot(collection(db, "cafes"), async (snapshot) => {
        const list = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const ratingsSnap = await getDocs(collection(db, `cafes/${docSnap.id}/ratings`));
          const ratings = ratingsSnap.docs.map((r) => r.data());

          const overall = ratings.length
            ? ratings.reduce((a, c) => a + (c.overall || 0), 0) / ratings.length
            : 0;

          const value = ratings.length
            ? ratings.reduce((a, c) => a + (c.value || 0), 0) / ratings.length
            : data.valueRating || 0;

          const service = ratings.length
            ? ratings.reduce((a, c) => a + (c.service || 0), 0) / ratings.length
            : data.serviceRating || 0;

          const userRating = ratings.find((r) => r.userId === usr?.uid);

          list.push({
            id: docSnap.id,
            ...data,
            avgOverall: overall,
            avgService: service,
            avgValue: value,
            userService: userRating?.service || 0,
            userValue: userRating?.value || 0,
            userOverall: userRating?.overall || 0,
          });
        }

        if (!suppressAvgUpdate) setCafes(list);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [suppressAvgUpdate]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const pos = await Location.getCurrentPositionAsync({});
      setUserRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    })();
  }, []);

  // COMMENTS ---------------------------------------------------------------
  useEffect(() => {
    if (!selectedCafe) return;

    if (!user) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, "cafes", selectedCafe.id, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return unsub;
  }, [selectedCafe, user]);

  const sendComment = async () => {
    if (!newComment.trim() || !user) return;

    await addDoc(collection(db, "cafes", selectedCafe.id, "comments"), {
      text: newComment,
      userId: user.uid,
      displayName: user.email?.split("@")[0] || "User",
      createdAt: serverTimestamp(),
    });

    setNewComment("");
  };

  // RATINGS ----------------------------------------------------------------
  const submitRating = async (cafeId, type, value) => {
    if (!user) return;

    setCafes((prev) =>
      prev.map((cafe) =>
        cafe.id === cafeId
          ? { ...cafe, [`user${type[0].toUpperCase() + type.slice(1)}`]: value }
          : cafe
      )
    );

    if (selectedCafe?.id === cafeId) {
      setSelectedCafe((prev) => ({
        ...prev,
        [`user${type[0].toUpperCase() + type.slice(1)}`]: value,
      }));
    }

    const ref = doc(db, `cafes/${cafeId}/ratings/${user.uid}`);
    await setDoc(ref, { userId: user.uid, [type]: value }, { merge: true });
  };

  // UI HELPERS -------------------------------------------------------------
  const facilityIcons = [
    { key: "bikes", icon: "motorbike" },
    { key: "scooters", icon: "moped" },
    { key: "cyclists", icon: "bicycle" },
    { key: "cars", icon: "car" },
    { key: "offRoadParking", icon: "parking" },
    { key: "pets", icon: "dog-side" },
    { key: "disability", icon: "wheelchair-accessibility" },
  ];

  const renderFacilityIcons = (cafe) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
      {facilityIcons.map(({ key, icon }) => {
        const active = cafe[key];
        return (
          <View
            key={key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 25,
              paddingVertical:8,
              margin: 1,
              backgroundColor: active ? "#007aff" : "#eee",
              borderRadius: 6,
            }}
          >
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={active ? "#fff" : "#333"}
              style={{ marginRight: 5 }}
            />
            <Text style={{ color: active ? "#fff" : "#333", fontSize: 13 }}></Text>
          </View>
        );
      })}
    </View>
  );

  const starRow = (label, avg, userVal, onPress) => (
    <View style={{ marginVertical: 6 }}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => onPress(n)}>
            <Ionicons
              name={n <= avg ? "star" : "star-outline"}
              size={22}
              color="#aaa"
              style={{ position: "absolute" }}
            />
            <Ionicons
              name={n <= userVal ? "star" : "star-outline"}
              size={22}
              color="#007aff"
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const openCard = (cafe) => {
    if (selectedCafe?.id === cafe.id) return;
    setSuppressAvgUpdate(true);
    setSelectedCafe(cafe);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeCard = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSelectedCafe(null);
      setSuppressAvgUpdate(false);
    });
  };

  // FILTER -----------------------------------------------------------------
  const filteredCafes = cafes.filter((cafe) => {
    const ratingMatch =
      cafe.avgOverall >= filter.overall &&
      cafe.avgService >= filter.service &&
      cafe.avgValue >= filter.value;

    const selectedFacilities = Object.keys(facilityFilters).filter((key) => facilityFilters[key]);
    const facilityMatch = selectedFacilities.every((key) => cafe[key]);

    return ratingMatch && facilityMatch;
  });

  // RENDER -----------------------------------------------------------------
  if (loading || !userRegion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007aff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Facility Filters */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 8 }}>
        {facilityIcons.map(({ key, icon }) => {
          const active = facilityFilters[key];
          const disabled = !user;
          return (
            <TouchableOpacity
              key={key}
              disabled={disabled}
              onPress={() =>
                setFacilityFilters((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 30,
                paddingVertical: 1,
                margin: 1,
                backgroundColor: active ? "#007aff" : "#eee",
                opacity: disabled ? 0.4 : 1,
                borderRadius: 6,
              }}
            >
              <MaterialCommunityIcons
                name={icon}
                size={18}
                color={active ? "#fff" : "#333"}
                style={{ marginRight: 5 }}
              />
              <Text style={{ color: active ? "#fff" : "#333" }}></Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* MAP */}
<ClusteredMapView
  ref={mapRef}
  style={{ flex: 1 }}
  region={userRegion}
  showsUserLocation
  clusterColor="#007aff"
  clusterTextColor="#fff"
  clusterFontSize={13}
  onPress={handleMapPress}
  onTouchStart={handleTouchStart}
>

        {filteredCafes.map((cafe) => (
          <Marker
            key={cafe.id}
            coordinate={{
              latitude: cafe.coords?.latitude,
              longitude: cafe.coords?.longitude,
            }}
            title={cafe.name}
            description={cafe.location}
            onPress={() => openCard(cafe)}
          />
        ))}

{waypoints.map((wp, i) => (
  <Marker
    key={`wp-${i}`}
    coordinate={wp}
    title={`Waypoint ${i + 1}`}
    description="Tap here to remove"
    pinColor="#00BFFF"
    onCalloutPress={async () => {
      const updated = waypoints.filter((_, idx) => idx !== i);
      setWaypoints(updated);

      if (routeVisible && lastSelectedCafeRef.current) {
        const newCoords = await recalcRouteWithWaypoints(updated);
        setRouteCoords(newCoords);
      }
    }}
  />
))}


        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#007aff" strokeWidth={4} />
        )}
      </ClusteredMapView>

      {/* Floating Navigate Button */}
{routeVisible && (
  <View style={styles.floatingButtonGroup}>
    {/* Save Route Button */}
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={handleSaveRoute}
    >
      <Text style={styles.navigateText}>Save Route</Text>
    </TouchableOpacity>

    {/* Navigate Button (existing full logic untouched) */}
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={() => {
        if (!userRegion || !lastSelectedCafeRef.current?.coords) {
          console.warn("Missing location or destination");
          return;
        }

        const cafe = lastSelectedCafeRef.current;
        const origin = encodeURIComponent("My Location");
        const destination = encodeURIComponent(
          cafe.address || cafe.name || "Destination"
        );

        const waypointParam = waypoints.length
          ? waypoints.map((wp) => `${wp.latitude},${wp.longitude}`).join("|")
          : "";

        if (Platform.OS === "ios" && waypoints.length === 0) {
          const url = `http://maps.apple.com/?saddr=Current%20Location&daddr=${destination}`;
          Linking.openURL(url);
        } else {
          const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
            waypointParam ? `&waypoints=${waypointParam}` : ""
          }`;
          Linking.openURL(url);
        }
      }}
    >
      <Text style={styles.navigateText}>Navigate</Text>
    </TouchableOpacity>
  </View>
)}


      {/* Bottom Card */}
      {selectedCafe && (
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Card Header */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <ScrollView>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{selectedCafe.name}</Text>
              <TouchableOpacity onPress={closeCard}>
                <Ionicons name="close-circle" size={22} color="#007aff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.cardLocation}>{selectedCafe.location}</Text>

            {/* Photos */}
            {Array.isArray(selectedCafe.photos) && selectedCafe.photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                {selectedCafe.photos.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={{
                      width: 240,
                      height: 160,
                      borderRadius: 10,
                      marginRight: 10,
                      backgroundColor: "#eee",
                    }}
                  />
                ))}
              </ScrollView>
            ) : selectedCafe.photoURL ? (
              <Image source={{ uri: selectedCafe.photoURL }} style={styles.cafeImage} resizeMode="cover" />
            ) : null}

            {starRow("Service", selectedCafe.avgService, selectedCafe.userService, (v) =>
              submitRating(selectedCafe.id, "service", v)
            )}
            {starRow("Value", selectedCafe.avgValue, selectedCafe.userValue, (v) =>
              submitRating(selectedCafe.id, "value", v)
            )}
            {starRow("Overall", selectedCafe.avgOverall, selectedCafe.userOverall, (v) =>
              submitRating(selectedCafe.id, "overall", v)
            )}

            {selectedCafe.priceRange && (
              <View style={{ marginTop: 8, marginBottom: 2 }}>
                <Text style={styles.priceLabel}>Price Range</Text>
                <Text style={styles.priceValue}>{selectedCafe.priceRange}</Text>
              </View>
            )}

            <View style={{ marginTop: 8, marginBottom: 6 }}>
              <Text style={styles.priceLabel}>Facilities</Text>
              {renderFacilityIcons(selectedCafe)}
            </View>

            {/* Comments */}
            <View style={{ marginTop: 12 }}>
              {user ? (
                <>
                  <Text style={{ fontWeight: "400", fontSize: 14, marginBottom: 6, marginTop: 12 }}>
                    Comments:
                  </Text>

                  {comments.map((c) => (
                    <Text key={c.id} style={{ marginBottom: 4 }}>
                      <Text style={{ fontWeight: "300" }}>{c.displayName}: </Text>
                      {c.text}
                    </Text>
                  ))}

                  <View style={{ flexDirection: "row", marginTop: 8 }}>
                    <TextInput
                      value={newComment}
                      onChangeText={setNewComment}
                      placeholder="Add a comment..."
                      style={{
                        flex: 1,
                        borderColor: "#ccc",
                        borderWidth: 1,
                        padding: 8,
                        borderRadius: 6,
                        marginRight: 6,
                      }}
                    />
                    <TouchableOpacity onPress={sendComment}>
                      <Text style={{ color: "#007aff", paddingVertical: 10 }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={{ marginTop: 8, color: "#666" }}>Sign in to view & add comments</Text>
              )}
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
<TouchableOpacity
  onPress={routeCoords.length > 0 ? handleClearRoute : handleRoutePress}
  style={styles.clearRouteButton}
>
  <Text style={styles.buttonText}>
    {routeCoords.length > 0 ? "Clear Route" : "Route"}
  </Text>
</TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const url = Platform.select({
                    ios: `maps:0,0?q=${selectedCafe.name}@${selectedCafe.coords?.latitude},${selectedCafe.coords?.longitude}`,
                    android: `geo:0,0?q=${selectedCafe.coords?.latitude},${selectedCafe.coords?.longitude}(${selectedCafe.name})`,
                  });
                  Linking.openURL(url);
                }}
                style={styles.navigateBtn}
              >
                <Text style={styles.buttonText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      )}
{showSaveModal && (
  <View style={styles.modalOverlay}>
    <View style={styles.modalBox}>
      <Text style={styles.modalTitle}>Save Route</Text>

      <TextInput
        placeholder="Enter a route name"
        value={routeName}
        onChangeText={setRouteName}
        style={styles.modalInput}
      />

      <View style={styles.modalButtonRow}>
        <TouchableOpacity
          style={[styles.modalButton, { backgroundColor: "#ccc" }]}
          onPress={() => {
            setRouteName("");
            setShowSaveModal(false);
          }}
        >
          <Text style={styles.modalButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modalButton, { backgroundColor: "#007aff" }]}
          onPress={async () => {
            if (!routeName.trim()) {
              console.warn("No route name entered");
              return;
            }

            const routeData = {
              name: routeName.trim(),
              start: userRegion,
              end: lastSelectedCafeRef.current.coords,
              waypoints,
            };

            try {
              await saveFavouriteRoute(user, routeData);
              console.log("Route saved!");
              setShowSaveModal(false);
              setRouteName("");
            } catch (err) {
              console.error("Failed to save route:", err);
            }
          }}
        >
          <Text style={[styles.modalButtonText, { color: "#fff" }]}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}

    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    height: "70%",
  },
  dragHandleContainer: { alignItems: "center", paddingVertical: 4 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ccc", opacity: 0.8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#333" },
  cardLocation: { fontSize: 13, color: "#666", marginTop: 4 },
  ratingLabel: { fontSize: 13, color: "#333", marginBottom: 4 },
  priceLabel: { fontSize: 13, color: "#333", marginBottom: 2 },
  priceValue: { fontSize: 15, fontWeight: "600", color: "#007aff" },
  navigateButton: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "#007aff",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  navigateText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  clearRouteButton: {
    flex: 1,
    backgroundColor: "#555",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },
  navigateBtn: {
    flex: 1,
    backgroundColor: "#007aff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
floatingButtonGroup: {
  position: "absolute",
  bottom: 40,
  right: 20,
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 12,
},
floatingButton: {
  backgroundColor: "#007aff",
  paddingVertical: 14,
  paddingHorizontal: 18,
  borderRadius: 50,
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 5,
  elevation: 5,
},
modalOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
},
modalBox: {
  width: "80%",
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: 20,
  elevation: 5,
},
modalTitle: {
  fontSize: 18,
  fontWeight: "600",
  marginBottom: 12,
  textAlign: "center",
},
modalInput: {
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 8,
  padding: 10,
  marginBottom: 16,
},
modalButtonRow: {
  flexDirection: "row",
  justifyContent: "space-between",
},
modalButton: {
  flex: 1,
  paddingVertical: 12,
  marginHorizontal: 4,
  borderRadius: 8,
  alignItems: "center",
},
modalButtonText: {
  fontWeight: "600",
  fontSize: 15,
},

});

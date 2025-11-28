import { Header } from "@components/layout/Header";
import PlaceCard from "@components/place/PlaceCard";
import { theme } from "@config/theme";
import { TabBarContext } from "@context/TabBarContext";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  GoogleMaps,
  Marker,
  Polyline
} from "expo-maps";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


// Debounce helper
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Simple distance helper (km)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return null;
  }

  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


export default function MapScreen() {
  const { route, mode } = useLocalSearchParams();
  const savedRoute = route ? JSON.parse(route) : null;

  const isRouteMode = !!savedRoute;
  const isNavigateMode = mode === "navigate";
  const isShowRouteMode = mode === "show";

  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Selected place / card state
  const [placeDetails, setPlaceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(false);

  const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Tab bar visibility
  const { hide, show } = useContext(TabBarContext);

  // Tab visibility respects both card mode AND navigate mode
  useEffect(() => {
    if (isNavigateMode || isCardVisible) hide();
    else show();
  }, [isNavigateMode, isCardVisible, hide, show]);

  useEffect(() => {
    return () => show();
  }, [show]);


  // ------------------------------------------------------------
  // Autocomplete
  // ------------------------------------------------------------
  const fetchAutocomplete = async (input) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&components=country:uk` +
        `&key=${PLACES_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      setSuggestions(data.status === "OK" ? data.predictions : []);
    } catch (err) {
      console.log("Autocomplete error:", err);
    }
  };

  const debouncedFetch = useMemo(() => debounce(fetchAutocomplete, 300), []);

  const onChangeSearch = (text) => {
    setQuery(text);
    debouncedFetch(text);
  };

  const handleAddWaypoint = () => {
    console.log("Add waypoint not implemented yet");
  };


  // ------------------------------------------------------------
  // Fetch place details
  // ------------------------------------------------------------
  const openPlaceFromId = useCallback(
    async (placeId, descriptionOverride) => {
      if (!placeId) return;

      try {
        setDetailsLoading(true);

        const url =
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${placeId}` +
          `&fields=geometry,name,rating,formatted_address,opening_hours,photos` +
          `&key=${PLACES_KEY}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK") {
          console.log("Place details error:", data.status);
          return;
        }

        const result = data.result;
        setPlaceDetails(result);
        setIsCardVisible(true);
        setQuery(descriptionOverride || result.name || "");

        const { lat, lng } = result.geometry.location;
        if (mapRef.current) {
          mapRef.current.setCameraPosition({
            coordinates: { latitude: lat, longitude: lng },
            zoom: 16
          });
        }
      } catch (err) {
        console.log("Place details error:", err);
      } finally {
        setDetailsLoading(false);
      }
    },
    [PLACES_KEY]
  );

  const handleSelectPlace = async (placeId, description) => {
    Keyboard.dismiss();
    setSuggestions([]);
    await openPlaceFromId(placeId, description);
  };


  // ------------------------------------------------------------
  // Map tap handler — DISABLED in route mode
  // ------------------------------------------------------------
  const handleMapPress = async (event) => {
    if (isRouteMode) return;

    try {
      Keyboard.dismiss();
      setSuggestions([]);

      const coords = event?.coordinates;

      if (!coords) return;

      const { latitude, longitude } = coords;

      if (mapRef.current) {
        mapRef.current.setCameraPosition({
          coordinates: { latitude, longitude },
          zoom: 16
        });
      }

      // Look for a nearby place from tap
      const nearby =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
        `?location=${latitude},${longitude}` +
        `&radius=150&key=${PLACES_KEY}`;

        //`https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        //`?query=prince` +
        //`&key=${PLACES_KEY}`;

      const res = await fetch(nearby);
      const data = await res.json();

      if (data.status === "OK" && data.results.length > 0) {
        await openPlaceFromId(data.results[0].place_id, data.results[0].name);
      }
console.log("Tap at: " , data.results[0]);
    } catch (err) {
      console.log("Map tap error:", err);
    }
  };


  // ------------------------------------------------------------
  // Get device location
  // ------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (mounted) setLoading(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      if (mounted) {
        setLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude
        });
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);


  // ------------------------------------------------------------
  // Initial camera
  // ------------------------------------------------------------
  const cameraForLocation = useMemo(() => {
    if (savedRoute?.snappedCoords?.length) {
      return {
        coordinates: savedRoute.snappedCoords[0],
        zoom: 12
      };
    }

    if (location) {
      return {
        coordinates: location,
        zoom: 15
      };
    }

    return {
      coordinates: { latitude: 51.5072, longitude: -0.1276 },
      zoom: 10
    };
  }, [location, savedRoute]);


  // ------------------------------------------------------------
  // Recenter: disabled in Navigate mode
  // ------------------------------------------------------------
  const recenter = () => {
    if (isNavigateMode) return;

    if (mapRef.current && location) {
      setQuery("");
      setSuggestions([]);
      Keyboard.dismiss();

      mapRef.current.setCameraPosition({
        coordinates: location,
        zoom: 15
      });
    }
  };


  const closeSearchUI = () => {
    Keyboard.dismiss();
    setSuggestions([]);
    setQuery("");
  };


  const handleNavigate = () => {
    const loc = placeDetails?.geometry?.location;
    if (!loc) return;

    const { lat, lng } = loc;
    const label = encodeURIComponent(placeDetails.name || "Destination");

    let url;
    if (Platform.OS === "ios") {
      url = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&q=${label}`;
    } else {
      url =
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }

    Linking.openURL(url).catch(console.log);
  };


  // ------------------------------------------------------------
  // Polyline + markers for route mode
  // ------------------------------------------------------------
  const startPoint = savedRoute?.start;
  const endPoint = savedRoute?.end;
  const waypointPoints = savedRoute?.waypoints || [];
  const polylineCoords = savedRoute?.snappedCoords || [];


  useEffect(() => {
    if (!isRouteMode) return;
    if (!polylineCoords || polylineCoords.length === 0) return;
    if (!mapRef.current) return;

    // Fit camera once map is ready:
    setTimeout(() => {
      try {
        mapRef.current.fitCoordinates(polylineCoords, {
          edgePadding: {
            top: 80,
            bottom: 80,
            left: 80,
            right: 80
          },
          animated: true
        });
      } catch (err) {
        console.log("fitCoordinates error:", err);
      }
    }, 400);
  }, [isRouteMode, polylineCoords]);


  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header mode="logo-title" title="Map" />

      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.colors.primaryLight} />
          </View>
        ) : (
          <GoogleMaps.View
            ref={mapRef}
            style={styles.map}
            cameraPosition={cameraForLocation}
            properties={{
              isMyLocationEnabled: !isNavigateMode,
              isTrafficEnabled: false,
              isPoiEnabled: !isRouteMode
            }}
            uiSettings={{
              myLocationButtonEnabled: false,
              compassEnabled: false,
              mapToolbarEnabled: false,
              zoomControlsEnabled: false,
              scaleBarEnabled: true
            }}
            onMapClick={handleMapPress}
          >
            {/* Route Polyline */}
            {isRouteMode && polylineCoords.length > 0 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor={theme.colors.primaryExtraLight}
                strokeWidth={5}
              />
            )}

            {/* Start Marker */}
            {isRouteMode && startPoint && (
              <Marker
                coordinate={startPoint}
                color={theme.colors.routeStart}
              />
            )}

            {/* Waypoints */}
            {isRouteMode &&
              waypointPoints.map((wp, i) => (
                <Marker
                  key={`wp-${i}`}
                  coordinate={wp}
                  color={theme.colors.routeWaypoint}
                />
              ))}

            {/* End Marker */}
            {isRouteMode && endPoint && (
              <Marker
                coordinate={endPoint}
                color={theme.colors.routeEnd}
              />
            )}
          </GoogleMaps.View>
        )}


        {/* Search bar (hidden in navigate mode or if viewing a route in navigate mode) */}
        {!isNavigateMode && !isRouteMode && (
          <View style={[styles.topRow, { top: 5 }]}>
            <View style={styles.searchContainer}>
              <TextInput
                value={query}
                onChangeText={onChangeSearch}
                placeholder="Search places…"
                placeholderTextColor="#888"
                style={styles.searchInput}
              />
            </View>

            <Pressable
              style={styles.filterButton}
              onPress={() => console.log("Filter pressed")}
            >
              <Ionicons name="filter" size={24} color="#333" />
            </Pressable>
          </View>
        )}


        {/* Suggestions list */}
        {!isNavigateMode && !isRouteMode && suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.place_id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    handleSelectPlace(item.place_id, item.description)
                  }
                  style={styles.suggestionItem}
                >
                  <Text style={styles.suggestionText}>
                    {item.description}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Dim area to close suggestions */}
        {!isNavigateMode && !isRouteMode && suggestions.length > 0 && (
          <Pressable style={styles.tapOverlay} onPress={closeSearchUI} />
        )}

        {/* Recenter button (hidden in navigate mode) */}
        {!isNavigateMode && (
          <Pressable
            style={[
              styles.recenterButton,
              { bottom: 55 + insets.bottom }
            ]}
            onPress={recenter}
          >
            <Ionicons
              name="locate"
              size={26}
              color={theme.colors.primary}
            />
          </Pressable>
        )}

        {/* Place-card (only allowed outside route mode) */}
        {!isRouteMode && isCardVisible && placeDetails && (
          <PlaceCard
            google={placeDetails}
            coffeeRider={null}
            onClose={() => setIsCardVisible(false)}
            onNavigate={handleNavigate}
            onAddWaypoint={handleAddWaypoint}
          />
        )}

        {detailsLoading && (
          <View style={styles.detailsLoadingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
          </View>
        )}
      </View>
    </View>
  );
}


// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },

  tapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500
  },

  topRow: {
    position: "absolute",
    left: 15,
    right: 15,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 600
  },

  searchContainer: {
    flex: 1,
    backgroundColor: "#f1f1f4",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4
  },
  searchInput: {
    fontSize: 16,
    color: "#333"
  },

  filterButton: {
    marginLeft: 10,
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f1f1f4",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4
  },

  suggestionsBox: {
    position: "absolute",
    top: 95,
    left: 15,
    right: 15,
    maxHeight: 220,
    backgroundColor: "#f1f1f4",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
    zIndex: 999
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  suggestionText: {
    fontSize: 15,
    color: "#333"
  },

  recenterButton: {
    position: "absolute",
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primaryExtraLight,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 500
  },

  detailsLoadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 700
  }
});

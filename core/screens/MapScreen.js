import { Header } from "@components/layout/Header";
import { theme } from "@config/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { GoogleMaps } from "expo-maps";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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
  const [reloadKey, setReloadKey] = useState(0);

  // Force reload when returning to this tab
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1);
    }, [])
  );

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

  // ------------------------------------------------------------
  // Fetch full place details (for card + centering)
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
          setDetailsLoading(false);
          return;
        }

        const result = data.result;
        setPlaceDetails(result);
        setIsCardVisible(true);

        // Fill the search bar with the name / description
        setQuery(descriptionOverride || result.name || "");

        // Center the map
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

  // ------------------------------------------------------------
  // Handle selecting from autocomplete list
  // ------------------------------------------------------------
  const handleSelectPlace = async (placeId, description) => {
    Keyboard.dismiss();
    setSuggestions([]); // close dropdown
    await openPlaceFromId(placeId, description);
  };

  // ------------------------------------------------------------
  // Handle tapping POIs on the map
  // ------------------------------------------------------------
  const handleMapPress = async (e) => {
    const native = e?.nativeEvent;
    if (native?.placeId) {
      // Treat map tap like selecting from list
      Keyboard.dismiss();
      setSuggestions([]);
      await openPlaceFromId(native.placeId);
    }
  };

  // ------------------------------------------------------------
  // Get device location
  // ------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      console.log("🔍 Requesting location permissions…");
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("📍 Permission status:", status);

      if (status !== "granted") {
        if (mounted) setLoading(false);
        return;
      }

      console.log("⏳ Getting current GPS position…");
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
  }, [reloadKey]);

  // ------------------------------------------------------------
  // Initial camera
  // ------------------------------------------------------------
  const cameraForLocation = useMemo(() => {
    if (location) {
      return {
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        zoom: 15
      };
    }

    return {
      coordinates: { latitude: 51.5072, longitude: -0.1276 },
      zoom: 10
    };
  }, [location]);

  // ------------------------------------------------------------
  // Recenter (keep card visible as per option A)
  // ------------------------------------------------------------
  const recenter = () => {
    if (mapRef.current && location) {
      // Clear search + suggestions (we agreed this earlier)
      setQuery("");
      setSuggestions([]);
      Keyboard.dismiss();

      mapRef.current.setCameraPosition({
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        zoom: 15
      });
    }
  };

  // ------------------------------------------------------------
  // Close autocomplete + keyboard (tap anywhere)
  // ------------------------------------------------------------
  const closeSearchUI = () => {
    Keyboard.dismiss();
    setSuggestions([]);
    setQuery("");
  };

  // ------------------------------------------------------------
  // Navigate button handler
  // ------------------------------------------------------------
  const handleNavigate = () => {
    const loc = placeDetails?.geometry?.location;
    if (!loc) return;

    const { lat, lng } = loc;
    const label = encodeURIComponent(placeDetails.name || "Destination");

    let url;
    if (Platform.OS === "ios") {
      url = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&q=${label}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }

    Linking.openURL(url).catch((err) =>
      console.log("Navigation error:", err)
    );
  };

  // ------------------------------------------------------------
  // Derived hero photo + distance
  // ------------------------------------------------------------
  const heroPhotoUrl = useMemo(() => {
    const ref = placeDetails?.photos?.[0]?.photo_reference;
    if (!ref) return null;

    return (
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=800&photo_reference=${ref}&key=${PLACES_KEY}`
    );
  }, [placeDetails, PLACES_KEY]);

  const distanceText = useMemo(() => {
    if (!location || !placeDetails?.geometry?.location) return null;

    const { lat, lng } = placeDetails.geometry.location;
    const d = getDistanceKm(location.latitude, location.longitude, lat, lng);
    if (d == null) return null;

    if (d < 1) {
      return `${Math.round(d * 1000)} m`;
    }
    return `${d.toFixed(1)} km`;
  }, [location, placeDetails]);

  const openNow =
    placeDetails?.opening_hours &&
    typeof placeDetails.opening_hours.open_now === "boolean"
      ? placeDetails.opening_hours.open_now
      : null;

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header mode="logo-title" title="Map" />

      <View key={reloadKey} style={styles.mapContainer}>
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
              isMyLocationEnabled: true,
              isTrafficEnabled: false,
              isPoiEnabled: true
            }}
            uiSettings={{
              myLocationButtonEnabled: false,
              compassEnabled: false,
              mapToolbarEnabled: false,
              zoomControlsEnabled: false
            }}
            onPress={handleMapPress}
          />
        )}

        {/* Tap-Anywhere Overlay (for autocomplete only) */}
        {suggestions.length > 0 && (
          <Pressable style={styles.tapOverlay} onPress={closeSearchUI} />
        )}

        {/* Search bar */}
        <View
          style={[
            styles.topRow,
            { top: 5 }
          ]}
        >
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

        {/* Autocomplete list */}
        {suggestions.length > 0 && (
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

        {/* Recenter button (kept visible even when card is open) */}
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

        {/* Place card bottom sheet */}
        {isCardVisible && placeDetails && (
          <View
            style={[
              styles.placeCard,
              { paddingBottom: 16 + insets.bottom }
            ]}
          >
            {/* Fixed header row */}
            <View style={styles.placeCardHeaderRow}>
              <View style={styles.placeCardHandle} />
              <Pressable hitSlop={12} onPress={() => setIsCardVisible(false)}>
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            </View>

            {/* Scroll content */}
            <ScrollView
              style={styles.placeScroll}
              contentContainerStyle={{ paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
            >
              {heroPhotoUrl && (
                <Image
                  source={{ uri: heroPhotoUrl }}
                  style={styles.placeHero}
                  resizeMode="cover"
                />
              )}

              <View style={styles.placeContent}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {placeDetails.name}
                </Text>

                <View style={styles.placeMetaRow}>
                  {/* rating, open now, distance chips stay the same */}
                </View>

                <Text style={styles.placeAddress} numberOfLines={3}>
                  {placeDetails.formatted_address}
                </Text>
              </View>

              {/* Action buttons */}
              <View style={styles.placeActionsRow}>
                <Pressable style={styles.primaryButton} onPress={handleNavigate}>
                  <Ionicons name="navigate" size={18} color={theme.colors.text} />
                  <Text style={styles.primaryButtonText}>Navigate</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => console.log("Save")}
                >
                  <Ionicons name="bookmark" size={18} color={theme.colors.accent} />
                  <Text style={styles.secondaryButtonText}>Save</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
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

  // Fullscreen tap overlay (to dismiss autocomplete)
  tapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500
  },

  // Search + filter
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

  // Autocomplete box
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

  // Recenter
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

  // Place card bottom sheet
  placeCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 95,
    backgroundColor: theme.colors.primaryLight,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 700,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
    maxHeight: "65%",
  },
  placeCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  placeCardHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginLeft: "40%"
  },
  placeHero: {
    width: "100%",
    height: 150,
    borderRadius: 14,
    marginBottom: 12
  },
  placeContent: {
    gap: 6,
    marginBottom: 12
  },
  placeName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text
  },
  placeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#1F2A33"
  },
  metaText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.textMuted
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  placeAddress: {
    fontSize: 13,
    color: theme.colors.textMuted
  },

  placeScroll: {
    maxHeight: "100%",
  },

  placeActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: 999
  },
  primaryButtonText: {
    marginLeft: 6,
    color: theme.colors.text,
    fontWeight: "600",
    fontSize: 14
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.accent
  },
  secondaryButtonText: {
    marginLeft: 6,
    color: theme.colors.accent,
    fontWeight: "500",
    fontSize: 14
  },

  detailsLoadingOverlay: {
    position: "absolute",
    right: 24,
    bottom: 150,
    backgroundColor: "rgba(22,32,40,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 800
  }

});

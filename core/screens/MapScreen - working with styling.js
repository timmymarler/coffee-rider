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
  Keyboard,
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

export default function MapScreen() {
  const [reloadKey, setReloadKey] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);


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
  // Handle selecting a place
  // ------------------------------------------------------------
  const handleSelectPlace = async (placeId, description) => {
    Keyboard.dismiss();
    setQuery(description);
    setSuggestions([]);

    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${placeId}` +
        `&fields=geometry,name` +
        `&key=${PLACES_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK") {
        const { lat, lng } = data.result.geometry.location;

        if (mapRef.current) {
          mapRef.current.setCameraPosition({
            coordinates: { latitude: lat, longitude: lng },
            zoom: 16
          });
        }
      }
    } catch (err) {
      console.log("Place details error:", err);
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
  // Recenter only
  // ------------------------------------------------------------
  const recenter = () => {
    if (mapRef.current && location) {
      setQuery("");           // clear search bar
      setSuggestions([]);     // close dropdown
      Keyboard.dismiss();     // hide keyboard

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
  // Close autocomplete + keyboard
  // ------------------------------------------------------------
  const closeSearchUI = () => {
    Keyboard.dismiss();
    setSuggestions([]);
    setQuery("");     // ALWAYS clear if user dismisses manually
  };

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
              isTrafficEnabled: false
            }}
            uiSettings={{
              myLocationButtonEnabled: false,
              compassEnabled: false,
              mapToolbarEnabled: false,
              zoomControlsEnabled: false
            }}
          />
        )}

        {/* Tap-Anywhere Overlay (above map, below search bar) */}
        {suggestions.length > 0 && (
          <Pressable style={styles.tapOverlay} onPress={closeSearchUI} />
        )}

        {/* Search bar */}
        <View
          style={[
            styles.topRow,
            { top: 20 + insets.top }
          ]}
        >
          <View style={styles.searchContainer}>
            <TextInput
              value={query}
              onChangeText={onChangeSearch}
              placeholder="Search places…"
              placeholderTextColor="#888"
              style={styles.searchInput}

              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onTouchStart={() => {
                // If already focused + tapped again → hide keyboard
                if (searchFocused) {
                  Keyboard.dismiss();
                }
              }}
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
                  onPress={() => {
                    Keyboard.dismiss();
                    setSuggestions([]); // close dropdown immediately
                    handleSelectPlace(item.place_id, item.description);
                  }}
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

        {/* Recenter button */}
        <Pressable
          style={[
            styles.recenterButton,
            { bottom: 75 + insets.bottom }
          ]}
          onPress={recenter}
        >
          <Ionicons
            name="locate"
            size={26}
            color={theme.colors.primary}
          />
        </Pressable>
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

  // Recenter only
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
  }
});

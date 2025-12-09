import { AuthContext } from "@context/AuthContext";
import theme from "@themes";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

// ------------------------------------------------
// GOOGLE POI TYPES (EDIT FREELY)
// ------------------------------------------------
const GOOGLE_POI_TYPES = [
  "cafe",
  "coffee_shop",
  "bakery",
  "restaurant",

];

// ------------------------------------------------
// SCREEN
// ------------------------------------------------
export default function MapScreenRN() {
  const router = useRouter();
  const mapRef = useRef(null);
  const { capabilities } = useContext(AuthContext);

  const [region, setRegion] = useState(null);

  // Ephemeral Google POI markers (tap-to-load)
  const [visiblePois, setVisiblePois] = useState([]);

  // Selected POI for card (marker tap OR long-press)
  const [selectedPlace, setSelectedPlace] = useState(null);

  // ------------------------------------------------
  // GET USER LOCATION
  // ------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          const fallback = {
            latitude: 52.1364,
            longitude: -0.4607,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };
          setRegion(fallback);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

        setRegion(newRegion);

        setTimeout(() => {
          mapRef.current?.animateToRegion(newRegion, 800);
        }, 300);
      } catch (err) {
        console.log("Location error:", err);
      }
    })();
  }, []);

  // ------------------------------------------------
  // GOOGLE POI SEARCH (PLACES API – NEW)
  // ------------------------------------------------
  const fetchGooglePois = async (
    latitude,
    longitude,
    radius,
    maxResults
  ) => {
    try {
      const res = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key":
              process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location",
          },
          body: JSON.stringify({
            includedTypes: GOOGLE_POI_TYPES,
            maxResultCount: maxResults,
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius,
              },
            },
          }),
        }
      );

      const json = await res.json();

      if (!json.places) return [];

      return json.places.map((place) => ({
        id: place.id,
        name: place.displayName?.text,
        address: place.formattedAddress,
        rating: place.rating,
        user_ratings_total: place.userRatingCount,
        geometry: {
          location: {
            lat: place.location.latitude,
            lng: place.location.longitude,
          },
        },
      }));
    } catch (err) {
      console.log("Places API error:", err);
      return [];
    }
  };

  // ------------------------------------------------
  // TAP = LOAD POIS IN AREA (MARKERS)
  // ------------------------------------------------
  const handleMapPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    const places = await fetchGooglePois(
      latitude,
      longitude,
      1800, // discovery radius
      20
    );
    setVisiblePois(places);
    setSelectedPlace(null);
  };

  // ------------------------------------------------
  // LONG PRESS = INSPECT NEAREST POI ONLY
  // ------------------------------------------------
  const handleLongPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    const places = await fetchGooglePois(
      latitude,
      longitude,
      80, // tight radius
      1
    );

    if (places.length > 0) {
      setSelectedPlace(places[0]);

      mapRef.current?.animateToRegion(
        {
          latitude: places[0].geometry.location.lat,
          longitude: places[0].geometry.location.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    } else {
      setSelectedPlace(null);
    }
  };

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        showsPointsOfInterest={true} // keep Google POIs visible
        initialRegion={
          region || {
            latitude: 52.1364,
            longitude: -0.4607,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }
        }
        onPress={handleMapPress}
        onLongPress={handleLongPress}
      >
        {visiblePois.map((place) => (
          <Marker
            key={place.id}
            coordinate={{
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng,
            }}
            onPress={() => setSelectedPlace(place)}
          />
        ))}
      </MapView>

      {/* GOOGLE PLACE CARD */}
      {selectedPlace && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {selectedPlace.name}
          </Text>

          {selectedPlace.address && (
            <Text style={styles.cardAddress}>
              {selectedPlace.address}
            </Text>
          )}

          {selectedPlace.rating && (
            <Text style={styles.cardRating}>
              ⭐ {selectedPlace.rating} (
              {selectedPlace.user_ratings_total})
            </Text>
          )}

          <TouchableOpacity
            onPress={() => setSelectedPlace(null)}
          >
            <Text style={styles.cardClose}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ADD VENUE FAB */}
      {capabilities?.canAddVenue && (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: theme.colors.accentMid },
          ]}
          onPress={() => router.push("/add-venue")}
        >
          <Text
            style={[
              styles.fabText,
              { color: theme.colors.primaryDark },
            ]}
          >
            Add Missing Venue
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ------------------------------------------------
// STYLES
// ------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  fab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 5,
    minWidth: 160,
    alignItems: "center",
  },

  fabText: {
    fontSize: 15,
    fontWeight: "600",
  },

  card: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 6,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },

  cardAddress: {
    marginTop: 4,
    color: theme.colors.textSecondary,
  },

  cardRating: {
    marginTop: 6,
    color: theme.colors.textSecondary,
  },

  cardClose: {
    marginTop: 12,
    color: theme.colors.accentMid,
    fontWeight: "600",
  },
});

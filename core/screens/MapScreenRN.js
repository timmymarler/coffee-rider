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
import SvgPin from "../map/components/SvgPin";

// ------------------------------------------------
// GOOGLE POI TYPES (EDIT FREELY)
// ------------------------------------------------
const GOOGLE_POI_TYPES = [
  "cafe",
  "coffee_shop",
  "bakery",
  "restaurant",
];
const POI_ICON_MAP = {
  // Coffee shops
  cafe: "coffee",
  coffee_shop: "coffee",
  bakery: "bakery-dining",
  cafeteria: "coffee",
  // Car park
  parking: "parking",
  //Sights
  tourist_attraction: "landscape",
  beach: "landscape",
  // Petrol / charging
  gas_station: "local-gas-station",
  electric_vehicle_charging_station: "ev-station",
  motorcycle_repair: "motorcycle",
  motorcycle_shop: "motorcycle",
  car_repair: "car",
  event_venue: "motorcycle",
  // Take-aways
  fast_food: "fastfood",
  fast_food_restaurant: "fastfood",
  sandwich_shop: "fastfood",  
  //Pubs / restaurants
  bar: "local-bar",
  pub: "local-bar",
  restaurant: "restaurant",
  // Places to stay
  lodging: "hotel",
  bed_and_breakfas: "hotel",
  hotel: "hotel",

};

/* ------------------------------
   Marker behaviour helpers
------------------------------ */

const getRiderPinColors = ({ source, selected }) => {
  if (selected) {
    return {
      fill: theme.colors.accentMid,
      border: theme.colors.accentDark,
    };
  }

  if (source === "google") {
    return {
      fill: theme.colors.accentLight,
      border: theme.colors.accentDark,
    };
  }

  // CR
  return {
    fill: theme.colors.accentMid,
    border: theme.colors.accentDark,
  };
};

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
                "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types",
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
        type: place.types?.[0],
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
      1500, // discovery radius
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
      10, // tight radius
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
        {visiblePois.map((place) => {
          const isSelected = selectedPlace?.id === place.id;
          const iconName = POI_ICON_MAP[place.type] || "place";

          const { fill, border } = getRiderPinColors({
            source: place.source, // "cr" | "google"
            selected: isSelected,
          });

          return (
            <Marker
              key={place.id}
              coordinate={{
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
              }}
              onPress={() => setSelectedPlace(place)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <SvgPin
                fill={fill}
                stroke={border}
                icon={iconName}
              />
            </Marker>
          );
        })}
      </MapView>

      {/* GOOGLE PLACE CARD */}
      {selectedPlace && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {selectedPlace.name} - {selectedPlace.type} 
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

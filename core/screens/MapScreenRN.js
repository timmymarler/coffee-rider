import { AuthContext } from "@context/AuthContext";
import theme from "@themes";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

// ------------------------------------------------
// GOOGLE POI TYPES (EDIT FREELY)
// ------------------------------------------------
const GOOGLE_POI_TYPES = [
  "cafe",
  "coffee_shop",
  "cafeteria",
  "bakery",
  "parking",
  "pub",
  "bar",
];
const POI_ICON_MAP = {
  // Coffee shops
  cafe: "coffee",
  coffee_shop: "coffee",
  bakery: "food",
  cafeteria: "food",
  // Car park
  parking: "parking",
  //Sights
  tourist_attraction: "map-pin",
  beach: "beach",
  // Petrol / charging
  gas_station: "gas-station",
  electric_vehicle_charging_station: "ev-station",
  motorcycle_repair: "motorbike",
  motorcycle_shop: "motorbike",
  car_repair: "car",
  event_venue: "motorbike",
  // Take-aways
  fast_food: "food",
  fast_food_restaurant: "food",
  sandwich_shop: "food",  
  //Pubs / restaurants
  bar: "beer",
  pub: "beer",
  restaurant: "food-fork-drink",
  // Places to stay
  lodging: "bed",
  bed_and_breakfas: "bed",
  hotel: "bed",

};

/* ------------------------------
   Marker behaviour helpers
------------------------------ */

const getRiderPinColors = ({ source, selected }) => {
  if (selected) {
    return {
      fill: theme.colors.primaryLight,
      border: theme.colors.accentDark,
    };
  }

  if (source === "google") {
    return {
      fill: theme.colors.primaryLight,
      border: theme.colors.accentDark,
    };
  }

  // CR
  return {
    fill: theme.colors.primaryLight,
    border: theme.colors.accentDark,
  };
};

function getGooglePhotoUrl(photoName, maxWidth = 800) {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`;
}

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
  
  // Need to create user object to catch long press for non logged in users
  const user = useContext(AuthContext);

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
              //"X-Goog-FieldMask":
              //  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types",
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types,places.photos",
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
        title: place.displayName?.text,
        address: place.formattedAddress,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        latitude: place.location.latitude,
        longitude: place.location.longitude,

        // ✅ existing
        source: "google",
        googlePhotos: place.photos?.map((p) => p.name) || [],
        googlePhotoUrls: place.photos?.map((p) =>
          getGooglePhotoUrl(p.name)
        ) || [],

        type: place.types?.[0],

        // ✅ keep geometry if map needs it
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
  const handleMapLongPress = async (e) => {
    if (!user?.role) return;

    const { latitude, longitude } = e.nativeEvent.coordinate;
    const role = user.role;

    const googlePlace = await getGooglePoiAtCoordinate({
      latitude,
      longitude,
    });

    // USER: POI only
    if (role === "user") {
      if (!googlePlace) return;
      setSelectedPlace(normalizeGooglePlace(googlePlace));
      return;
    }

    // PRO / ADMIN
    if (role === "pro" || role === "admin") {
      if (googlePlace) {
        setSelectedPlace(normalizeGooglePlace(googlePlace));
      } else {
        setSelectedPlace({
          source: "manual",
          latitude,
          longitude,
        });
      }
    }
  };

  async function getGooglePoiAtCoordinate({ latitude, longitude }) {
    try {
      const res = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types,places.photos",
          },
          body: JSON.stringify({
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius: 80, // very small radius = intentional POI press
              },
            },
            maxResultCount: 1,
          }),
        }
      );

      const json = await res.json();
      if (!json.places || json.places.length === 0) {
        console.log("[LONG PRESS] No POI returned by Google");
      } else {
        console.log(
          "[LONG PRESS] POI returned:",
          json.places[0].displayName?.text
        );
      }

      return json.places?.[0] ?? null;
    } catch (err) {
      console.log("[LONG PRESS] POI lookup failed", err);
      return null;
    }
  }

  function normalizeGooglePlace(place) {
    return {
      id: place.id,
      title: place.displayName?.text,
      address: place.formattedAddress,
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      rating: place.rating,
      userRatingsTotal: place.userRatingCount,
      type: place.types?.[0],
      source: "google",
      googlePhotoUrls: place.photos?.map((p) =>
        `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
      ) || [],
    };
  }

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
        onLongPress={handleMapLongPress}
      >
        {visiblePois.map((place) => {
          const isSelected = selectedPlace?.id === place.id;
          const iconName = POI_ICON_MAP[place.type] || "map-marker";

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
              onPress={(e) => {
                e.stopPropagation();
                setSelectedPlace(place);
              }}
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

      {selectedPlace && (
        <PlaceCard
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
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

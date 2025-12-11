import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import theme from "@themes";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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
  // Sights
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
  // Pubs / restaurants
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
  // Selected marker: highlight
  if (selected) {
    return {
      fill: theme.colors.primaryLight,
      border: theme.colors.accentDark,
    };
  }

  // CR vs Google styling – tweak later if you want more contrast
  if (source === "cr") {
    return {
      fill: theme.colors.accentMid,
      border: theme.colors.accentDark,
    };
  }

  // Default / Google
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

  const auth = useContext(AuthContext);
  const { role } = auth || {};

  const [region, setRegion] = useState(null);

  // Ephemeral Google POIs (tap-to-load)
  const [googlePois, setGooglePois] = useState([]);

  // Persistent CR places from Firestore
  const [crPlaces, setCrPlaces] = useState([]);

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
  // FIRESTORE LISTENER FOR CR PLACES
  // ------------------------------------------------
  useEffect(() => {
    const q = query(collection(db, "places"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const loc = data.location || {};
          const latitude = loc.latitude;
          const longitude = loc.longitude;

          return {
            id: docSnap.id,
            title: data.name,
            type: data.type ?? null,
            source: "cr",
            latitude,
            longitude,
            suitability: data.suitability || {},
            amenities: data.amenities || {},
            crRatings: data.crRatings || {},
            googlePhotoUrls: data.googlePhotoUrls || [],
            geometry: {
              location: {
                lat: latitude,
                lng: longitude,
              },
            },
          };
        });

        setCrPlaces(docs);
      },
      (error) => {
        console.log("[CR PLACES] listener error", error);
      }
    );

    return () => unsubscribe();
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

        source: "google",
        googlePhotos: place.photos?.map((p) => p.name) || [],
        googlePhotoUrls:
          place.photos?.map((p) => getGooglePhotoUrl(p.name)) || [],

        type: place.types?.[0],

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
  // TAP = LOAD GOOGLE POIS IN AREA (MARKERS)
  // ------------------------------------------------
  const handleMapPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const places = await fetchGooglePois(
      latitude,
      longitude,
      1500,
      20
    );
    setGooglePois(places);
    setSelectedPlace(null);
  };

  // ------------------------------------------------
  // LONG PRESS = INSPECT / SAVE NEAREST POI OR MANUAL
  // ------------------------------------------------
  const handleMapLongPress = async (e) => {
    // Only logged-in roles can long-press
    if (!role) return;

    const { latitude, longitude } = e.nativeEvent.coordinate;
    
    // 1. Check if long-press is near an existing CR place
    const existingCr = crPlaces.find(p => {
        const dx = Math.abs(p.latitude - latitude);
        const dy = Math.abs(p.longitude - longitude);

        // crude proximity check, but works perfectly at this zoom:
        return dx < 0.0005 && dy < 0.0005;
    });

    if (existingCr) {
        // Open the CR place in VIEW mode, not create mode
        setSelectedPlace(existingCr);
        return;
    }

    const googlePlace = await getGooglePoiAtCoordinate({
      latitude,
      longitude,
    });

    // USER: POI only (view)
    if (role === "user") {
      if (!googlePlace) return;
      setSelectedPlace(normalizeGooglePlace(googlePlace));
      return;
    }

    // PRO / ADMIN: either Google-import or manual
    if (role === "pro" || role === "admin") {
      if (googlePlace) {
        const normalized = normalizeGooglePlace(googlePlace);
        // Flag this as a "Google → CR" creation candidate
        normalized.source = "google-new";
        setSelectedPlace(normalized);
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
            "X-Goog-Api-Key":
              process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types,places.photos",
          },
          body: JSON.stringify({
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius: 80,
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
      googlePhotoUrls:
        place.photos?.map(
          (p) =>
            `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
        ) || [],
    };
  }

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------
  const allMarkers = [...googlePois, ...crPlaces];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        showsPointsOfInterest={true}
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
        {allMarkers.map((place) => {
          const isSelected = selectedPlace?.id === place.id;

          const { fill, border } = getRiderPinColors({
            source: place.source, // "cr" | "google"
            selected: isSelected,
          });

          const iconName = POI_ICON_MAP[place.type] || "map-marker";

          const lat =
            place.geometry?.location?.lat ?? place.latitude ?? 0;
          const lng =
            place.geometry?.location?.lng ?? place.longitude ?? 0;

          return (
            <Marker
              key={place.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedPlace(place);
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <SvgPin fill={fill} stroke={border} icon={iconName} />
            </Marker>
          );
        })}
      </MapView>

      {selectedPlace && (
        <PlaceCard
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onPlaceCreated={(newPlace) => {
            console.log("[MAP] CR place created", newPlace);

            // Optimistically add CR marker while Firestore listener catches up
            setCrPlaces((prev) => {
              if (prev.some((p) => p.id === newPlace.id)) return prev;
              return [
                ...prev,
                {
                  ...newPlace,
                  geometry: {
                    location: {
                      lat: newPlace.latitude,
                      lng: newPlace.longitude,
                    },
                  },
                },
              ];
            });

            // Clear selection first so React re-renders correctly
            setSelectedPlace(null);
            // Re-select the CR marker (forces the new pin style to show immediately)
            setTimeout(() => setSelectedPlace(newPlace), 50);          }}
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

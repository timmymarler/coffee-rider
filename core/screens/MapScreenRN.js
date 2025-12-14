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
import { classifyPoi } from "../map/classify/classifyPois";
import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";
import { applyFilters } from "../map/filters/applyFilters";
import { FILTER_GROUPS } from "../map/filters/filterGroups";
import { normalisePoi } from "../map/normalise/normalisePoi";

// ------------------------------------------------
// GOOGLE POI TYPES (EDIT FREELY)
// ------------------------------------------------
const GOOGLE_POI_TYPES = [
  "automotive",
];

// ---- POI ICON MAPPING FOR RIDER ----
// Expanded to cover all Google types you've actually seen in your results.
// Ensures food, fuel, bike shops, cafés, and pubs always get the correct icons.

export const POI_ICON_MAP = {
  // ---- Coffee / Café ----
  cafe: "coffee",
  coffee_shop: "coffee",
  tea_house: "coffee",
  dog_cafe: "coffee",
  bakery: "food",
  cafeteria: "food",
  food_store: "food",                 // Google uses this for bakery/café hybrids
  breakfast_restaurant: "coffee",
  brunch_restaurant: "coffee",

  // ---- Restaurants / Food ----
  restaurant: "food-fork-drink",
  food: "food-fork-drink",
  fast_food: "food",
  fast_food_restaurant: "food",
  meal_takeaway: "food",
  sandwich_shop: "food",
  dessert_restaurant: "food-fork-drink",
  vegetarian_restaurant: "food-fork-drink",
  vegan_restaurant: "food-fork-drink",
  bar_and_grill: "food-fork-drink",
  seafood_restaurant: "food-fork-drink",
  turkish_restaurant: "food-fork-drink",

  // ---- Pubs / Bars ----
  bar: "beer",
  pub: "beer",

  // ---- Fuel / Vehicle ----
  gas_station: "gas-station",
  electric_vehicle_charging_station: "ev-station",
  motorcycle_repair: "motorbike",
  motorcycle_shop: "motorbike",
  motorcyle: "motorbike",
  auto_parts_store: "motorbike",

  // ---- Parking ----
  parking: "parking",

  // ---- Attractions / Misc ----
  tourist_attraction: "map-marker",
  historical_landmark: "map-marker",
  museum: "map-marker",
  park: "map-marker",
  playground: "map-marker",

  // ---- Generic Fallbacks ----
//  point_of_interest: "map-marker",
//  establishment: "map-marker",
};

/* ------------------------------
   Marker behaviour helpers
------------------------------ */

const getRiderPinColors = ({ source, selected, suitability }) => {
  let baseColors = {
    fill: theme.colors.primaryLight,
    border: theme.colors.primaryMid,
  };

  // GOOGLE POIs
  if (source === "google") {
    baseColors = {
      fill: theme.colors.primaryLight,
      border: theme.colors.primaryMid,
    };
  }

  // CR PLACES — Suitability logic
  if (source === "cr") {
    const isBikeFriendly =
      suitability?.bikers || suitability?.scooters;

    const isDriverFriendly =
      suitability?.evDrivers || suitability?.cars;

    const isStriderFriendly =
      suitability?.cyclists || suitability?.walkers;

    if (isBikeFriendly) {
      baseColors = {
        fill: theme.colors.accentMid,
        border: theme.colors.accentLight,
      };
    } else if (isDriverFriendly) {
      baseColors = {
        fill: theme.colors.primaryMid,
        border: theme.colors.accentMid,
      };
    } else if (isStriderFriendly) {
      baseColors = {
        fill: theme.colors.secondaryMid,
        border: theme.colors.accentMid,
      };
    }
  }

  // SELECTED OVERLAY → do NOT change category colour!
  if (selected) {
    return {
      fill: baseColors.fill,
      border: theme.colors.accentDark,   // highlight only
    };
  }

  return baseColors;
};

export default function MapScreenRN() {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const { user, role } = auth || {};

  const mapRef = useRef(null);

  const [region, setRegion] = useState(null);
  const [googlePois, setGooglePois] = useState([]);
  const [crPlaces, setCrPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [filters, setFilters] = useState({
    query: "",
    categories: new Set(),     // e.g. "cafe", "fuel"
    suitability: new Set(),    // e.g. "bikers", "scooters"
    amenities: new Set(),      // e.g. "parking", "outdoorSeating"
  });

  // ------------------------------------------------
  // GET USER LOCATION
  // ------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        console.log("[MAP] Requesting location permissions…");
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        console.log("[MAP] Permission status:", status);
        if (status !== "granted") {
          console.log(
            "[MAP] Location permission not granted, using fallback region"
          );
          const fallbackRegion = {
            latitude: 52.1364, // Bedford-ish
            longitude: -0.4607,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };
          setRegion(fallbackRegion);
          return;
        }

        console.log("[MAP] Getting current GPS position…");
        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        console.log("[MAP] Current position:", loc.coords);

        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

        setRegion(newRegion);

        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 800);
          }
        }, 300);
      } catch (err) {
        console.log("[MAP] Error fetching location:", err);
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

          let base = normalisePoi({
            ...data,
            id: docSnap.id,
            source: "cr",
            latitude,
            longitude,

            suitability: data.suitability || {},
            amenities: data.amenities || {},
          });

          // CLASSIFY IT
          base.category = classifyPoi(base, FILTER_GROUPS);

          return {
            ...base,
            crRatings: data.crRatings || base.crRatings || {},
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

  // Deduplicate Google POIs if they overlap CR places (~50m)
  useEffect(() => {
    if (googlePois.length === 0 || crPlaces.length === 0) return;

    const deduped = googlePois.filter((g) => {
      return !crPlaces.some((c) => {
        const dx = Math.abs(c.latitude - g.latitude);
        const dy = Math.abs(c.longitude - g.longitude);
        return dx < 0.0005 && dy < 0.0005; // ~50m
      });
    });

    if (deduped.length !== googlePois.length) {
      setGooglePois(deduped);
    }
  }, [googlePois, crPlaces]);

  // ------------------------------------------------
  // GOOGLE POI SEARCH (TEXT SEARCH)
  // ------------------------------------------------
  const fetchGooglePois = async (latitude, longitude, radius, maxResults) => {
    try {
      const res = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key":
              process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": [
              "places.id",
              "places.displayName",
              "places.formattedAddress",
              "places.rating",
              "places.userRatingCount",
              "places.location",
              "places.types",
              "places.photos",
            ].join(","),
          },
          body: JSON.stringify({
            textQuery:
              "cafe OR coffee OR tea OR sandwich OR biker OR motorcycle OR motorbike OR petrol OR gas OR pub OR scenic",
            languageCode: "en",

            locationBias: {
              circle: {
                center: { latitude, longitude },
                radius,
              },
            },

            maxResultCount: maxResults,
          }),
        }
      );

      const json = await res.json();

      // DEBUG BLOCK (you can remove this when happy)
      if (json.places) {
        json.places.forEach((p, i) => {
          const name = p.displayName?.text || "";
          const types = p.types || [];
          const category = p.category || "";
          const keywords = [
            "cafe",
            "coffee",
            "biker",
            "motorcycle",
            "scenic",
            "tea",
            "fuel",
            "petrol",
            "gas",
            "pub",
            "restaurant",
          ].filter((kw) => name.toLowerCase().includes(kw));

          console.log(
            `${i + 1}. ${name}\n` +
              `   Types: ${JSON.stringify(types)}\n` +
              `   Keywords: ${
                keywords.length ? keywords.join(", ") : "None"
              }\n`
          );
        });

      }

      if (!json.places) return [];

      // MANUAL FILTER (replaces includedTypes)
      const allowedTypes = [
        "cafe",
        "coffee_shop",
        "cafeteria",
        "bakery",
        "parking",
        "gas_station",
        "motorcycle_shop",
        "motorcycle_repair",
        "auto_parts_store",
        "tourist_attraction",
      ];

      const filtered = json.places.filter((p) => {
        return p.types?.some((t) => allowedTypes.includes(t));
      });

      // NEW: normalise all Google places into canonical POIs
      return filtered.map((place) => {
        const poi = normalisePoi({
          ...place,
          source: "google",
        });

        // CLASSIFY IT
        poi.category = classifyPoi(poi, FILTER_GROUPS);
        return poi;
      });
    } catch (err) {
      console.log("TEXT SEARCH ERROR:", err);
      return [];
    }
  };

  // ------------------------------------------------
  // TAP = LOAD GOOGLE POIS IN AREA (MARKERS)
  // ------------------------------------------------
  const handleMapPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    const places = await fetchGooglePois(latitude, longitude, 1500, 20);

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
    const existingCr = crPlaces.find((p) => {
      const dx = Math.abs(p.latitude - latitude);
      const dy = Math.abs(p.longitude - longitude);

      // crude proximity check, but works perfectly at this zoom:
      return dx < 0.0005 && dy < 0.0005;
    });

    if (existingCr) {
      // Open the CR place in VIEW mode, not create mode
      setSelectedPlace({ ...existingCr });
      return;
    }

    const googlePlace = await getGooglePoiAtCoordinate({
      latitude,
      longitude,
    });

    // USER: POI only (view)
    if (role === "user") {
      if (!googlePlace) return;
        const normalizedUser = normalisePoi({
          ...googlePlace,
          source: "google",
        });

        normalizedUser.category = classifyPoi(normalizedUser, FILTER_GROUPS);
        setSelectedPlace({ ...normalizedUser });
      return;
    }

    // PRO / ADMIN: either Google-import or manual
    if (role === "pro" || role === "admin") {
      if (googlePlace) {
        let normalized = normalisePoi({
          ...googlePlace,
          source: "google",
        });

        normalized.category = classifyPoi(normalized, FILTER_GROUPS);
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

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------
  const visibleCrPlaces = crPlaces;

  const allMarkers = [...googlePois, ...visibleCrPlaces];
  const filteredMarkers = allMarkers.filter((poi) =>
    applyFilters(poi, filters, "rider")
  );

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
        {filteredMarkers.map((place) => {
          const isSelected = selectedPlace?.id === place.id;

          const { fill, border } = getRiderPinColors({
            source: place.source,
            selected: isSelected,
            suitability: place.suitability,
          });

          const iconName = POI_ICON_MAP[place.category] || "map-marker";

          const lat =
            place.latitude ?? place.geometry?.location?.lat ?? 0;
          const lng =
            place.longitude ?? place.geometry?.location?.lng ?? 0;

          return (
            <Marker
              key={`${place.id}-${isSelected ? "sel" : "unsel"}`}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedPlace({ ...place });
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

            setSelectedPlace(null);

            setTimeout(() => setSelectedPlace(newPlace), 50);
          }}
        />
      )}
    </View>
  );
}

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

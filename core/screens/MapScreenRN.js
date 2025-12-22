import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { db } from "@config/firebase";
import { collection, onSnapshot } from "firebase/firestore";

import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

import * as Location from "expo-location";
import { classifyPoi } from "../map/classify/classifyPois";
import { FilterBar } from "../map/components/FilterBar";
import { RIDER_FILTER_GROUPS } from "../map/config/riderFilterGroups";
import { applyFilters } from "../map/filters/applyFilters";

/* ------------------------------------------------------------------ */
/* CATEGORY → ICON MAP                                                */
/* ------------------------------------------------------------------ */

const CATEGORY_ICON_MAP = {
  cafe: "coffee",
  restaurant: "silverware-fork-knife",
  pub: "beer",
  fuel: "gas-station",
  parking: "parking",
  scenic: "forest",
  bikes: "motorbike",
  scooters: "moped",
};

/* ------------------------------------------------------------------ */
/* FILTER STATE                                                       */
/* ------------------------------------------------------------------ */

const EMPTY_FILTERS = {
  categories: new Set(),
  amenities: new Set(),
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */

function inRegion(p, region) {
  if (!region) return false;
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
  return (
    p.latitude >= latitude - latitudeDelta / 2 &&
    p.latitude <= latitude + latitudeDelta / 2 &&
    p.longitude >= longitude - longitudeDelta / 2 &&
    p.longitude <= longitude + longitudeDelta / 2
  );
}

function dedupeById(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.source || "unknown"}-${it.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* GOOGLE NEARBY SEARCH (ROBUST)                                       */
/* ------------------------------------------------------------------ */

const INCLUDED_TYPES = [
  "cafe",
  "restaurant",
  "bar",
  "bakery",
  "tourist_attraction",
  "park",
  "parking",
  "gas_station",
];

async function doNearbyRequest({ latitude, longitude, radius, includedTypes }) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.log("[GOOGLE] Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY");
    return { places: [], error: "Missing API key" };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.types",
        "places.photos",
        "places.rating",
        "places.userRatingCount",
        "places.regularOpeningHours",
      ].join(","),
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius,
        },
      },
      includedTypes,
      maxResultCount: 20,
    }),
  });

  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    console.log("[GOOGLE] Failed to parse JSON:", e);
    return { places: [], error: "Invalid JSON response" };
  }

  if (!res.ok) {
    // Places API errors are typically in json.error
    console.log("[GOOGLE] searchNearby error:", res.status, json?.error || json);
    return { places: [], error: json?.error?.message || `HTTP ${res.status}` };
  }

  return { places: json?.places || [], error: null };
}

function mapGooglePlace(place) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  const types = Array.isArray(place.types) ? place.types : [];
  const category = classifyPoi({ types });

  return {
    id: place.id,
    title: place.displayName?.text || "",
    address: place.formattedAddress || "",
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    googleTypes: types,
    category,
    rating: place.rating,
    userRatingsTotal: place.userRatingCount,
    regularOpeningHours: place.regularOpeningHours,
    googlePhotoUrls:
      place.photos?.map(
        (p) =>
          `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`
      ) || [],
    source: "google",
    amenities: [],
  };
}

async function fetchNearbyPois(latitude, longitude, radius) {
  // Attempt 1: multi-type request (fastest if accepted)
  const attempt = await doNearbyRequest({
    latitude,
    longitude,
    radius,
    includedTypes: INCLUDED_TYPES,
  });

  if (attempt.error) {
    // Fallback: request each type separately and merge
    const all = [];
    for (const t of INCLUDED_TYPES) {
      const one = await doNearbyRequest({
        latitude,
        longitude,
        radius,
        includedTypes: [t],
      });
      if (one.error) {
        // Keep going, but log it
        console.log(`[GOOGLE] type "${t}" failed:`, one.error);
        continue;
      }
      all.push(...(one.places || []));
    }
    const mapped = dedupeById(all.map(mapGooglePlace).filter((p) => p.latitude && p.longitude));
    console.log("[GOOGLE] nearby fallback places:", mapped.length);
    return mapped;
  }

  const mapped = (attempt.places || [])
    .map(mapGooglePlace)
    .filter((p) => p.latitude && p.longitude);

  console.log("[GOOGLE] nearby places:", mapped.length);
  return mapped;
}

  function dedupeByProximity(crPlaces, googlePlaces) {
    const CR_RADIUS_METERS = 40;

    function distanceMeters(a, b) {
      const dx = (a.latitude - b.latitude) * 111320;
      const dy = (a.longitude - b.longitude) * 40075000 * Math.cos(a.latitude * Math.PI / 180) / 360;
      return Math.sqrt(dx * dx + dy * dy);
    }

    return googlePlaces.filter((g) => {
      return !crPlaces.some((c) => {
        return distanceMeters(c, g) < CR_RADIUS_METERS;
      });
    });
  }

/* ------------------------------------------------------------------ */
/* MAIN SCREEN                                                        */
/* ------------------------------------------------------------------ */

export default function MapScreenRN() {
  const mapRef = useRef(null);

  const [crPlaces, setCrPlaces] = useState([]);
  const [googlePois, setGooglePois] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [userLocation, setUserLocation] = useState(null);

  const [mapRegion, setMapRegion] = useState(null);

  const [selectedPlaceId, setSelectedPlaceId] = useState(null);

  /* ------------------------------------------------------------ */
  /* LOAD CR PLACES                                               */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "places"), (snapshot) => {
      const places = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          source: "cr",
          title: data.name,
          latitude: data.location?.latitude,
          longitude: data.location?.longitude,
          category: data.category || "unknown",
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          rating: data.rating,
          ...data,
        };
      });

      setCrPlaces(places);
    });

    return unsub;
  }, []);

  /* ------------------------------------------------------------ */
  /* USER LOCATION                                                */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);
    })();
  }, []);

  /* ------------------------------------------------------------ */
  /* FETCH GOOGLE POIS ON REGION CHANGE                            */
  /* ------------------------------------------------------------ */

  const handleRegionChangeComplete = async (region) => {
    setMapRegion(region);

    const radius =
      region.latitudeDelta < 0.03 ? 800 :
      region.latitudeDelta < 0.08 ? 1500 :
      3000;

    const pois = await fetchNearbyPois(region.latitude, region.longitude, radius);

    // Replace is fine because visibility is computed from viewport;
    // also keeps memory bounded and behaviour predictable.
    setGooglePois(pois);
  };

  /* ------------------------------------------------------------ */
  /* TOP 20 SELECTOR                                               */
  /* ------------------------------------------------------------ */

  const visiblePlaces = useMemo(() => {
    if (!mapRegion) return [];

    const dedupedGoogle = dedupeByProximity(crPlaces, googlePois);
    let candidates = [...crPlaces, ...dedupedGoogle];

    // Hard filters
    if (filters.categories.size || filters.amenities.size) {
      candidates = candidates.filter((p) => applyFilters(p, filters));
    }

    // CR first, then Google. Each sorted by rating desc
    const cr = candidates.filter((p) => p.source === "cr");
    const google = candidates.filter((p) => p.source !== "cr");

    const byRating = (a, b) => (b.rating || 0) - (a.rating || 0);

    cr.sort(byRating);
    google.sort(byRating);

    return [...cr, ...google].slice(0, 20);
  }, [crPlaces, googlePois, mapRegion, filters]);

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null;
    return visiblePlaces.find((p) => p.id === selectedPlaceId) || null;
  }, [selectedPlaceId, visiblePlaces]);

  /* ------------------------------------------------------------ */
  /* RENDER                                                       */
  /* ------------------------------------------------------------ */

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={() => setSelectedPlaceId(null)}
        initialRegion={{
          latitude: 52.136,
          longitude: -0.467,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
          {visiblePlaces.map((poi) => {
            const category = poi.category || "unknown";
            const icon =
              CATEGORY_ICON_MAP[category] || CATEGORY_ICON_MAP.unknown;

            const isCr = poi.source === "cr";

          // Brighter CR markers, muted Google markers
          const fill = "#9CA3AF";
          const circle = isCr ? "#FFD85C" : "#C5A041";

          return (
            <Marker
              key={`${poi.source}-${poi.id}`}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              onPress={(e) => {
                e.stopPropagation?.();
                setSelectedPlaceId(poi.id);
              }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={true}
            >
              <SvgPin
                icon={icon}
                fill={fill}
                circle={circle}
              />
            </Marker>
          );
        })}
      </MapView>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        filterConfig={RIDER_FILTER_GROUPS}
      />

      <TouchableOpacity
        onPress={() => {
          if (!userLocation) return;
          mapRef.current?.animateToRegion(
            {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            300
          );
        }}
        style={styles.recenterButton}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#FFD85C" />
      </TouchableOpacity>

      {selectedPlace && (
        <PlaceCard
          place={selectedPlace}
          userLocation={userLocation}
          onClose={() => setSelectedPlaceId(null)}
          onNavigate={() => ""}
          onRoute={() => ""}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  recenterButton: {
    position: "absolute",
    right: 16,
    bottom: 95,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
});

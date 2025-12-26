import { db } from "@config/firebase";
import { TabBarContext } from "@context/TabBarContext";
import { collection, onSnapshot } from "firebase/firestore";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

import * as Location from "expo-location";
import { classifyPoi } from "../map/classify/classifyPois";
import { FilterBar } from "../map/components/FilterBar";
import { RIDER_FILTER_GROUPS } from "../map/config/riderFilterGroups";
import { applyFilters } from "../map/filters/applyFilters";
import { searchQuery, setSearchQuery } from useState("");
/* Ready for routing */
import { decode } from "@mapbox/polyline";
import { fetchRoute } from "../map/utils/fetchRoute";
//import { mapRef } from "../map/utils/mapRef"; // adjust path if needed
import { openNativeNavigation } from "../map/utils/navigation";

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
  unknown: "map-marker",
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

function expandRegion(region, factor = 1.4) {
  if (!region) return null;
  return {
    ...region,
    latitudeDelta: region.latitudeDelta * factor,
    longitudeDelta: region.longitudeDelta * factor,
  };
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

function dedupeByProximity(crPlaces, googlePlaces) {
  const CR_RADIUS_METERS = 40;

  function distanceMeters(a, b) {
    const dx = (a.latitude - b.latitude) * 111320;
    const dy =
      (a.longitude - b.longitude) *
      (40075000 * Math.cos((a.latitude * Math.PI) / 180)) /
      360;
    return Math.sqrt(dx * dx + dy * dy);
  }

  return googlePlaces.filter((g) => {
    return !crPlaces.some((c) => distanceMeters(c, g) < CR_RADIUS_METERS);
  });
}

function getIconForCategory(category) {
  if (CATEGORY_ICON_MAP[category]) return CATEGORY_ICON_MAP[category];

  switch (category) {
    case "food":
      return CATEGORY_ICON_MAP.restaurant;
    case "bar":
      return CATEGORY_ICON_MAP.pub;
    case "gas_station":
      return CATEGORY_ICON_MAP.fuel;
    case "tourist_attraction":
    case "landmark":
    case "viewpoint":
    case "park":
      return CATEGORY_ICON_MAP.scenic;
    default:
      return CATEGORY_ICON_MAP.unknown;
  }
}


/* ------------------------------------------------------------------ */
/* GOOGLE NEARBY SEARCH (NEW API)                                      */
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
  const attempt = await doNearbyRequest({
    latitude,
    longitude,
    radius,
    includedTypes: INCLUDED_TYPES,
  });

  if (attempt.error) {
    const all = [];
    for (const t of INCLUDED_TYPES) {
      const one = await doNearbyRequest({
        latitude,
        longitude,
        radius,
        includedTypes: [t],
      });
      if (one.error) {
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

  return mapped;
}

/* ------------------------------------------------------------------ */
/* MAIN SCREEN                                                        */
/* ------------------------------------------------------------------ */

export default function MapScreenRN({ mapKey }) {
  const mapRef = useRef();

  const [crPlaces, setCrPlaces] = useState([]);
  const [googlePois, setGooglePois] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [userLocation, setUserLocation] = useState(null);

  const [mapRegion, setMapRegion] = useState(null);

  // Selected marker/placecard
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);

  // Temporary “promoted” Google place (in-memory only)
  const [tempCrPlace, setTempCrPlace] = useState(null);

  // Routing
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDestinationId, setRouteDestinationId] = useState(null);

  const hasRoute = routeCoords.length > 0;
  const [routeMeta, setRouteMeta] = useState(null);
  const [followUser, setFollowUser] = useState(false);
  const { setMapActions } = useContext(TabBarContext);


  useEffect(() => {
    setMapActions({
      recenter: recentreToCurrentPosition,
      toggleFollow: toggleFollowMe,
      isFollowing: () => followUser,
    });
  }, [followUser, userLocation]);

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
    let subscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,      // 1s updates
          distanceInterval: 5,     // or every ~5m
        },
        (location) => {
          setUserLocation(location.coords);
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  /* ------------------------------------------------------------ */
  /* FOLLOW MODE                                                  */
  /* ------------------------------------------------------------ */

  useEffect(() => {

    if (!followUser || !userLocation || !mapRef.current) return;
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          zoom: 16,
        },
        { duration: 600 }
      );

  }, [userLocation, followUser]);

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
    setGooglePois(pois);
  };

  /* ------------------------------------------------------------ */
  /* TEMP PROMOTION (GOOGLE -> TEMP CR)                            */
  /* ------------------------------------------------------------ */

  function promoteGoogleToTempCr(googlePlace) {
    if (!googlePlace) return null;

    const temp = {
      ...googlePlace,
      id: `temp-${googlePlace.id}`,
      source: "cr",       // treat like CR for visibility/priority
      _temp: true,        // flag for us
      _googleId: googlePlace.id,
    };

    setTempCrPlace(temp);
    return temp;
  }

  function clearTempIfSafe() {
    // Keep the temp place if it is the current route destination (so it doesn’t vanish mid-route).
    if (tempCrPlace && routeDestinationId === tempCrPlace.id) return;
    setTempCrPlace(null);
  }

  function clearRoute() {
    setRouteCoords([]);
    setRouteDestinationId(null);
    setTempCrPlace(null);   // ✅ THIS is the missing piece
    setRouteMeta(null);
  }

  /* Used for Follow Me mode */
  function toggleFollowMe() {
    setFollowUser((prev) => !prev);
  }

  function recentreToCurrentPosition() {
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      300
    );
  }

  useEffect(() => {
    setMapActions({
      recenter: recentreToCurrentPosition,
      toggleFollow: toggleFollowMe,
      isFollowing: () => followUser,
    });
  }, [followUser, userLocation]);

  /* ------------------------------------------------------------ */
  /* TOP 20 SELECTOR                                               */
  /* ------------------------------------------------------------ */

  const paddedRegion = useMemo(() => expandRegion(mapRegion, 1.4), [mapRegion]);

  const visiblePlaces = useMemo(() => {

    if (!mapRegion || !paddedRegion) return [];

    const dedupedGoogle = dedupeByProximity(crPlaces, googlePois);

    // Base candidates: (optional temp CR) + CR + Google
    let candidates = tempCrPlace
      ? [tempCrPlace, ...crPlaces, ...dedupedGoogle]
      : [...crPlaces, ...dedupedGoogle];

    // Always apply region culling (buffered), but NEVER cull:
    // - temp promoted place
    // - route destination
    candidates = candidates.filter((p) => {
      if (tempCrPlace && p.id === tempCrPlace.id) return true;
      if (routeDestinationId && p.id === routeDestinationId) return true;
      return inRegion(p, paddedRegion);
    });

    // Hard filters (if any)
    if (filters.categories.size || filters.amenities.size) {
      candidates = candidates.filter((p) => applyFilters(p, filters));
    }

    // CR first (includes temp because we set source="cr"), then Google
    const cr = candidates.filter((p) => p.source === "cr");
    const google = candidates.filter((p) => p.source !== "cr");

    const byRating = (a, b) => (b.rating || 0) - (a.rating || 0);
    cr.sort(byRating);
    google.sort(byRating);

    let result = [...cr, ...google].slice(0, 20);

    // Force include selected place (prevents card/marker disappearing if it falls out of top 20)
    if (selectedPlaceId) {
      const forced =
        candidates.find((p) => p.id === selectedPlaceId) ||
        (tempCrPlace && tempCrPlace.id === selectedPlaceId ? tempCrPlace : null);

      if (forced && !result.some((p) => p.id === forced.id)) {
        result = [...result, forced];
      }
    }

    // Force include route destination (same reason)
    if (routeDestinationId) {
      const forced =
        candidates.find((p) => p.id === routeDestinationId) ||
        (tempCrPlace && tempCrPlace.id === routeDestinationId ? tempCrPlace : null);

      if (forced && !result.some((p) => p.id === forced.id)) {
        result = [...result, forced];
      }
    }

    return result;
  }, [
    crPlaces,
    googlePois,
    mapRegion,
    paddedRegion,
    filters,
    selectedPlaceId,
    tempCrPlace,
    routeDestinationId,
  ]);

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null;
    return visiblePlaces.find((p) => p.id === selectedPlaceId) || null;
  }, [selectedPlaceId, visiblePlaces]);

  /* ------------------------------------------------------------ */
  /* ROUTING                                                      */
  /* ------------------------------------------------------------ */

  async function handleRoute(place) {
    if (!place) return;
    if (!userLocation) return;

    setRouteDestinationId(place.id);

    const result = await fetchRoute({
      origin: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      destination: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
    });

    if (!result?.polyline) return;

    const decoded = decode(result.polyline).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));
    setRouteMeta({
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
    });
    setRouteCoords(decoded);

    mapRef.current?.fitToCoordinates(decoded, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
  }

  function handleNavigate(place) {
    if (!place || !userLocation) return;

    openNativeNavigation({
      destination: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
      waypoints: [], // ready for future Pro routes
    });

    setFollowUser(true);
  }

  /* ------------------------------------------------------------ */
  /* RENDER                                                       */
  /* ------------------------------------------------------------ */

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        key={mapKey}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={() => {
          // Only clear selection if no active route
          if (!routeCoords.length) {
            setSelectedPlaceId(null);
            clearTempIfSafe();
          }
        }}
        onPanDrag={() => {
          if (followUser) setFollowUser(false);
        }}
        initialRegion={{
          latitude: 52.136,
          longitude: -0.467,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
        {visiblePlaces.map((poi) => {
          const category = poi.category || "unknown";
          const icon = getIconForCategory(category);

          const isCr = poi.source === "cr" && !poi._temp;
          const isTemp = !!poi._temp;
          const isDestination = routeDestinationId && poi.id === routeDestinationId;

          // Brighter CR markers, muted Google markers; destination green.
          // Temp promoted place treated as CR visually (same family).
          const fill = "#9CA3AF";
          const circle = (isCr || isTemp) ? "#FFD85C" : "#C5A041";

          return (
            <Marker
              key={`${poi.source}-${poi.id}`}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              onPress={(e) => {
                e.stopPropagation?.();

                if (poi.source === "google") {
                  const temp = promoteGoogleToTempCr(poi);
                  if (temp) setSelectedPlaceId(temp.id);
                  return;
                }

                // CR or temp (already promoted)
                setSelectedPlaceId(poi.id);

              }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={isDestination ? 1000 : 1}
              tracksViewChanges={true}
            >
              <SvgPin icon={icon} fill={fill} circle={circle} />
            </Marker>
          );
        })}

        <Polyline
          coordinates={routeCoords}
          strokeWidth={3}
          strokeColor="#2563eb"
          zIndex={1000}
        />
      </MapView>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        results={[]}
        onClear={() => setSearchQuery("")}
        onResultPress={() => {}}
        onFilterPress={() => {}}
      />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        filterConfig={RIDER_FILTER_GROUPS}
      />

      {selectedPlace && (
        <PlaceCard
          place={selectedPlace}
          userLocation={userLocation}
          hasRoute={routeCoords.length > 0}
          routeMeta={routeMeta}
          onRoute={(placeArg) => {
            // If somehow a Google place slips through, promote it before routing so it behaves like CR
            if (placeArg?.source === "google") {
              const temp = promoteGoogleToTempCr(placeArg);
              if (temp) {
                setSelectedPlaceId(temp.id);
                handleRoute(temp);
              }
              return;
            }
            handleRoute(placeArg);
          }}
          onClearRoute={clearRoute}
          onClose={() => {
            setSelectedPlaceId(null);
            clearTempIfSafe();
          }}
          onNavigate={handleNavigate}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

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




import { db } from "@config/firebase";
import { TabBarContext } from "@context/TabBarContext";
import { collection, onSnapshot } from "firebase/firestore";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

import * as Location from "expo-location";
import { classifyPoi } from "../map/classify/classifyPois";
import { applyFilters } from "../map/filters/applyFilters";
/* Ready for routing */
import { decode } from "@mapbox/polyline";
import { SearchBar } from "../map/components/SearchBar";
import { fetchRoute } from "../map/utils/fetchRoute";

import { saveRoute } from "@/core/map/routes/saveRoute";
import { openNativeNavigation, openNavigationWithWaypoints } from "@/core/map/utils/navigation";
import { AuthContext } from "@context/AuthContext";
import { GOOGLE_PHOTO_LIMITS } from "@core/config/photoPolicy";
import useWaypoints from "@core/map/waypoints/useWaypoints";
import { WaypointsContext } from "@core/map/waypoints/WaypointsContext";
import WaypointsList from "@core/map/waypoints/WaypointsList";
import { getCapabilities } from "@core/roles/capabilities";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import theme from "@themes";
import { doc, getDoc } from "firebase/firestore";
import { useCallback } from "react";
import { Modal, Pressable } from "react-native";
import { RIDER_AMENITIES } from "../config/amenities/rider";
import { RIDER_CATEGORIES } from "../config/categories/rider";
import { RIDER_SUITABILITY } from "../config/suitability/rider";
import { getPlaceLabel } from "../lib/geocode";

const RECENTER_ZOOM = 12;
const FOLLOW_ZOOM = 17; // closer, more “navigation” feel
const ENABLE_GOOGLE_AUTO_FETCH = true;

/* ------------------------------------------------------------------ */
/* CATEGORY → ICON MAP                                                */
/* ------------------------------------------------------------------ */
const SUITABILITY_ICON_MAP = {
  bikers: "motorbike",
  scooters: "moped",
  cyclists: "bicycle",
}

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


const AMENITY_ICON_MAP = {
  toilets: "toilet",
  outdoor_seating: "table-picnic",
  parking: "parking",
};

/* Rider focussed for now - add theme specific later */
const FILTER_SUITABILITIES = RIDER_SUITABILITY;
const FILTER_CATEGORIES = RIDER_CATEGORIES;
const FILTER_AMENITIES = RIDER_AMENITIES;

/* ------------------------------------------------------------------ */
/* FILTER STATE                                                       */
/* ------------------------------------------------------------------ */

const EMPTY_FILTERS = {
  suitability: new Set(),
  categories: new Set(),
  amenities: new Set(),
};

const DEFAULT_FILTERS = {
  suitability: [],
  categories: [],
  amenities: [],
};

const DEFAULT_MAP_STATE = {
  followUser: false,
  selectedPlace: null,
  route: null,
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

function matchesQuery(place, query) {
  if (!query) return false;
  const q = query.toLowerCase();

  const title = place.title?.toLowerCase() || "";
  const address = place.address?.toLowerCase() || "";

  return title.includes(q) || address.includes(q);
}

function toggleFilter(set, value) {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
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

async function doNearbyRequest({ latitude, longitude, radius, includedTypes, capabilities }) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.log("[GOOGLE] Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY");
    return { places: [], error: "Missing API key" };
  }

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
    "places.rating",
    "places.userRatingCount",
    "places.regularOpeningHours",
  ];

  // Only Pro/Admin may request photo metadata
  if (capabilities.canViewGooglePhotos) {
    fieldMask.push("places.photos");
  }


  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask.join(","),
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

function mapGooglePlace(place, capabilities) {
  const types = Array.isArray(place.types) ? place.types : [];
  const category = classifyPoi({ types });
  const googlePhotoRefs =
    capabilities?.canViewGooglePhotos && Array.isArray(place.photos)
      ? place.photos
          .map((p) => p.name || p.photo_reference)
          .filter(Boolean)
          .slice(0, GOOGLE_PHOTO_LIMITS.maxPhotosPerPlace)
      : [];

  return {
    id: place.id,
    title: place.displayName?.text || "",
    address: place.formattedAddress || null,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    googleTypes: types,
    category,
    rating: place.rating,
    userRatingsTotal: place.userRatingCount,
    regularOpeningHours: place.regularOpeningHours,
    googlePhotoRefs, // ✅ now defined
    source: "google",
    amenities: [],
  };
}

async function fetchNearbyPois(latitude, longitude, radius, capabilities) {
  const attempt = await doNearbyRequest({
    latitude,
    longitude,
    radius,
    includedTypes: INCLUDED_TYPES,
    capabilities,
  });

  if (attempt.error) {
    const all = [];

    for (const t of INCLUDED_TYPES) {
      const one = await doNearbyRequest({
        latitude,
        longitude,
        radius,
        includedTypes: [t],
        capabilities, // 🔒 REQUIRED
      });

      if (one.error) {
        console.log(`[GOOGLE] type "${t}" failed:`, one.error);
        continue;
      }

      all.push(...(one.places || []));
    }

    const mapped = dedupeById(
      all
        .map(p => mapGooglePlace(p, capabilities)) // 🔒 REQUIRED
        .filter(p => p.latitude && p.longitude)
    );

    console.log("[GOOGLE] nearby fallback places:", mapped.length);
    return mapped;
  }

  const mapped = (attempt.places || [])
    .map(p => mapGooglePlace(p, capabilities))
    .filter(p => p.latitude && p.longitude);

  return mapped;
}

/* ------------------------------------------------------------------ */
/* MAIN SCREEN                                                        */
/* ------------------------------------------------------------------ */

export default function MapScreenRN() {
  const mapRef = useRef();

  const [crPlaces, setCrPlaces] = useState([]);
  const [googlePois, setGooglePois] = useState([]);

  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const filtersActive = appliedFilters.suitability.size > 0 || appliedFilters.categories.size > 0 || appliedFilters.amenities.size > 0;
  const [userLocation, setUserLocation] = useState(null);

  const [mapRegion, setMapRegion] = useState(userLocation);

  // Selected marker/placecard
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);

  // Temporary “promoted” Google place (in-memory only)
  const [tempCrPlace, setTempCrPlace] = useState(null);

  // Routing
  const [routeCoords, setRouteCoords] = useState([]);

  const hasRoute = routeCoords.length > 0;
  const [routeMeta, setRouteMeta] = useState(null);
  const [followUser, setFollowUser] = useState(false);
  const { setMapActions } = useContext(TabBarContext);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");   // what user is typing
  const [activeQuery, setActiveQuery] = useState("");   // what we are actually searching
  const [searchOrigin, setSearchOrigin] = useState(null);
  const { user, role = "guest" } = useContext(AuthContext);
  const capabilities = getCapabilities(role);

  const [searchNotice, setSearchNotice] = useState(null);
  const [postbox, setPostbox] = useState(null);
  const isSearchActive = !!activeQuery;
  const [mapKey, setMapKey] = useState(0);

  const skipNextFollowTickRef = useRef(false);
  const {
    waypoints,
    addFromPlace,
    addFromMapPress,
    formatPoint,
    clearWaypoints,
  } = useWaypoints();
  
  const [routingActive, setRoutingActive] = useState(false);
  const [routeDestination, setRouteDestination] = useState(null);
  const [routeClearedByUser, setRouteClearedByUser] = useState(false);
  const routeRequestId = useRef(0);
  const [routeVersion, setRouteVersion] = useState(0);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(null);
  const routeFittedRef = useRef(false);
  const canSaveRoute = 
    capabilities.canSaveRoute &&
    routeMeta &&
    (routeDestination || waypoints.length > 0);
  const [lastEncodedPolyline, setLastEncodedPolyline] = useState(null);

  const {
    pendingSavedRouteId,
    setPendingSavedRouteId,
  } = useContext(WaypointsContext);
  const mapReadyRef = useRef(false);
  const pendingFitRef = useRef(null);
  
  const displayWaypoints = useMemo(() => {
    if (!routeDestination) return waypoints;
    return [
      ...waypoints,
      {
        ...routeDestination,
        isTerminal: true,
      },
    ];
  }, [waypoints, routeDestination]);
  const [pendingMapPoint, setPendingMapPoint] = useState(null);
  const [showAddPointMenu, setShowAddPointMenu] = useState(false);
  const [manualStartPoint, setManualStartPoint] = useState(null);
  const hasRouteIntent = routeDestination || waypoints.length > 0;

  const closeAddPointMenu = () => {
    setShowAddPointMenu(false);
    setPendingMapPoint(null);
  };

  const handleAddWaypoint = () => {
    setSelectedPlaceId(null);
    addFromMapPress(pendingMapPoint);
    closeAddPointMenu();
  };

  const handleSetStart = () => {
    setSelectedPlaceId(null);
    setFollowUser(false);
    setManualStartPoint({
      latitude: pendingMapPoint.latitude,
      longitude: pendingMapPoint.longitude,
    });
    closeAddPointMenu();
  };

  const handleSetDestination = () => {
    setSelectedPlaceId(null);
    const point = formatPoint(pendingMapPoint);
    setRouteDestination({
      latitude: point.lat,
      longitude: point.lng,
      title: point.title,
    });

    closeAddPointMenu();
  };

// state

  function clearNavigationIntent() {
    clearRoute();
  }

  useFocusEffect(
    useCallback(() => {
      setMapKey((k) => k + 1);
    }, [])
  );
  async function handleSaveRoute() {
    if (!routeCoords.length || !user) return;
    if (!user) {
      setPostbox({
        type: "info",
        message: "You need to be logged in to save routes.",
      });
      return;
    }

    const destination = getFinalDestination();

    await saveRoute({
      user,
      visibility: "private", // change later via UI
      origin: {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      },
      destination: destination
        ? {
            lat: destination.latitude ?? destination.lat,
            lng: destination.longitude ?? destination.lng,
            title: destination.title ?? null,
            placeId: destination.id ?? null,
          }
        : null,
      waypoints: waypoints.map(wp => ({
        lat: wp.latitude ?? wp.lat,
        lng: wp.longitude ?? wp.lng,
        title: wp.title ?? null,
        source: wp.source ?? "manual",
      })),
      routeMeta,
      polyline: lastEncodedPolyline, // see note below
    });
    setPostbox({
      type: "success",
      message: "Route saved successfully.",
    });

  }

  function getFinalDestination() {
    if (routeDestination) return routeDestination;
    if (waypoints.length > 0) return waypoints[waypoints.length - 1];
    return null;
  }

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
          rating: data.rating,
          ...data,

          // NORMALISED AFTER spread
          suitability: Array.isArray(data.suitability)
            ? data.suitability
            : Object.keys(data.suitability || {}),

          amenities: Array.isArray(data.amenities)
            ? data.amenities
            : Object.keys(data.amenities || {}),
        };
      });

      setCrPlaces(places);
    });

    return unsub;
  }, []);

  /* ------------------------------------------------------------ */
  /* USER LOCATION                                                */
  /* ------------------------------------------------------------ */
  async function ensureUserLocation() {
    if (userLocation) return userLocation;

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation(current.coords);
      return current.coords;
    } catch (e) {
      return null;
    }
  }

  async function recenterOnUser({ zoom = null } = {}) {
    if (!mapRef.current) return;

    const coords = await ensureUserLocation();
    if (!coords) return;

    mapRef.current.animateCamera(
      {
        center: { latitude: coords.latitude, longitude: coords.longitude },
        ...(zoom !== null ? { zoom } : {}),
      },
      { duration: 350 }
    );
  }

  function handleRecentre() {
    setFollowUser(false);
    recenterOnUser({ zoom: RECENTER_ZOOM });
  }

  /* ------------------------------------------------------------ */
  /* FOLLOW MODE                                                  */
  /* ------------------------------------------------------------ */
  async function toggleFollowMe() {
    // Turning OFF: do nothing else
    if (followUser) {
      setFollowUser(false);
      return;
    }

    // Turning ON: recenter + zoom FIRST
    skipNextFollowTickRef.current = true; // prevent immediate follow tick overriding
    await recenterOnUser({ zoom: FOLLOW_ZOOM });

    // Now enable follow mode
    setFollowUser(true);
  }

  useEffect(() => {
    if (!followUser) return;
    if (!userLocation) return;

    if (skipNextFollowTickRef.current) {
      skipNextFollowTickRef.current = false;
      return;
    }

    recenterOnUser(); // center only
  }, [userLocation, followUser]);


  useEffect(() => {
    setMapActions({
      recenter: handleRecentre,
      toggleFollow: toggleFollowMe,
      isFollowing: () => followUser,
    });

    return () => {
      setMapActions(null);
    };
  }, [followUser]);

  useEffect(() => {
    let subscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // 1️⃣ IMMEDIATE location (fixes first tap issue)
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation(current.coords);

      // 2️⃣ CONTINUOUS updates (Follow Me)
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 5,
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
  /* FETCH GOOGLE POIS ON REGION CHANGE                            */
  /* ------------------------------------------------------------ */

  const handleRegionChangeComplete = async (region) => {
    setMapRegion(region);
    // Temporarily disable requests to Google Places
    if (!ENABLE_GOOGLE_AUTO_FETCH || !capabilities.canSearchGoogle) {
      return;
    }
    const radius =
      region.latitudeDelta < 0.03 ? 800 :
      region.latitudeDelta < 0.08 ? 1500 :
      3000;
// Google nearby auto-fetch disabled by design.
// Text search is the only Google entry point.
//    const pois = await fetchNearbyPois(region.latitude, region.longitude, radius, capabilities);
//    setGooglePois(pois);
  };
  
  useEffect(() => {
    if (!pendingSavedRouteId) return;

    loadSavedRouteById(pendingSavedRouteId);
    setPendingSavedRouteId(null);
  }, [pendingSavedRouteId]);

  /* ------------------------------------------------------------ */
  /* TEMP PROMOTION (GOOGLE -> TEMP CR)                            */
  /* ------------------------------------------------------------ */

  function promoteGoogleToTempCr(googlePlace) {
    if (!googlePlace) return null;

    const temp = {
      // Core CR identity
      id: `temp-${googlePlace.id}`,
      source: "cr",              // ✅ MUST be "cr"
      _temp: true,

      // Location & display
      title: googlePlace.title,
      address: googlePlace.address,
      latitude: googlePlace.latitude,
      longitude: googlePlace.longitude,

      // CR fields
      photos: [],                // no CR photos yet
      amenities: [],

      // 🔑 The critical join key
      googlePlaceId: googlePlace.id,

      // Google-only ephemeral data
      googlePhotoRefs: googlePlace.googlePhotoRefs ?? [],
      googleRating: googlePlace.rating,
      googleUserRatingsTotal: googlePlace.userRatingsTotal,
      regularOpeningHours: googlePlace.regularOpeningHours,
    };

    setTempCrPlace(temp);
    return temp;
  }


  function clearTempIfSafe() {
    // Keep the temp place if it is the current route destination (so it doesn’t vanish mid-route).
    if (tempCrPlace && routeDestination === tempCrPlace.id) return;
    setTempCrPlace(null);
  }

  function clearRoute() {
    routeRequestId.current += 1;   // invalidate in-flight requests
    setRoutingActive(false);
    setRouteDestination(null);
    clearWaypoints();
    setRouteCoords([]);            // ✅ clear polyline HERE
    setRouteDistanceMeters(null);
    setManualStartPoint(null); 
    routeFittedRef.current = false;
  }

  function clearSearch() {
    setActiveQuery("");
    setGooglePois([]);
    setSearchInput("");
    setActiveQuery("");

  }

  /* Used for Follow Me mode */

  async function doTextSearch({ query, latitude, longitude, radius = 50000 }) {
    if (!capabilities?.canSearchGoogle) {
      console.log("[GOOGLE] doTextSearch blocked by capability");
      return [];
    }

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.log("[GOOGLE] Missing API key");
      return [];
    }
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.types",
      "places.rating",
      "places.userRatingCount",
      "places.regularOpeningHours",
    ];

    if (capabilities.canViewGooglePhotos) {
      fieldMask.push("places.photos");
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask.join(","),
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius,
          },
        },
        maxResultCount: 20,
      }),
      
    });

    const json = await res.json();
    if (!res.ok) {
      console.log("[GOOGLE] text search error:", json?.error || json);
      return [];
    }

    return (json?.places || [])
      .map((p) => mapGooglePlace(p, capabilities))
      .filter(p => p.latitude && p.longitude);
  }

  useEffect(() => {
    if (!postbox) return;

    const timer = setTimeout(() => {
      setPostbox(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [postbox]);

  const lastSearchRef = useRef("");

  useEffect(() => {
    if (!activeQuery || !searchOrigin) return;

    // 🔒 HARD GATE: guests (or restricted roles) cannot hit Google
    if (!capabilities.canSearchGoogle) {
      console.log("[SEARCH] Google search blocked for role");
      setGooglePois([]); // ensure no stale results linger
      setSearchNotice({
        title: "Search restricted",
        message: "You must log in to use the search function.",
      });      
      return;
    }    
    // Prevent duplicate searches
    if (lastSearchRef.current === activeQuery) return;
    lastSearchRef.current = activeQuery;

    let cancelled = false;

    async function run() {
      const { latitude, longitude, latitudeDelta } = searchOrigin;

      const radius =
        latitudeDelta < 0.03 ? 15000 :
        latitudeDelta < 0.08 ? 30000 :
        50000;

      const results = await doTextSearch({
        query: activeQuery,
        latitude,
        longitude,
        radius,
        capabilities,
      });

      if (cancelled) return;

      setGooglePois(results);

      // --- Prefer CR match if one exists ---
      const crMatch = crPlaces.find(
        (p) => p.source === "cr" && matchesQuery(p, activeQuery)
      );

      if (crMatch && mapRef.current) {
        // Select it so PlaceCard opens
        setSelectedPlaceId(crMatch.id);

        // Zoom to CR place
        mapRef.current.animateCamera(
          {
            center: {
              latitude: crMatch.latitude,
              longitude: crMatch.longitude,
            },
          },
          { duration: 600 }
        );

        return; // ⛔ important: don't auto-fit to all results
      }

      if (results.length && mapRef.current) {
        mapRef.current.fitToCoordinates(
          results.map(p => ({
            latitude: p.latitude,
            longitude: p.longitude,
          })),
          {
            edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
            animated: true,
          }
        );
      }
    }

    run();
    setSearchNotice(null);
    return () => { cancelled = true; };
  }, [activeQuery, searchOrigin]);

  useEffect(() => {
    if (routeClearedByUser) return;
    if (!userLocation) return;

    const hasInputs =
      routeDestination !== null || waypoints.length > 0;

    if (!hasInputs) {
      if (routeCoords.length > 0) {
        setRouteCoords([]);
      }
      return;
    }

    const requestId = ++routeRequestId.current;
    buildRoute({ requestId });
  }, [routeDestination, waypoints, routeClearedByUser, userLocation]);


  /* ------------------------------------------------------------ */
  /* TOP 20 SELECTOR                                               */
  /* ------------------------------------------------------------ */

  const paddedRegion = useMemo(() => expandRegion(mapRegion, 1.4), [mapRegion]);

  const crMarkers = useMemo(() => {
    if (!paddedRegion) return [];

    let list = crPlaces.filter((p) => inRegion(p, paddedRegion));

    if (
      appliedFilters.suitability.size ||
      appliedFilters.categories.size ||
      appliedFilters.amenities.size
    ) {
      list = list.filter((p) =>
        applyFilters(p, appliedFilters)
      );
    }

    return list;
  }, [
    crPlaces,
    paddedRegion,
    appliedFilters,
  ]);

  const searchMarkers = useMemo(() => {
    if (!activeQuery) return [];
    if (!paddedRegion) return [];

    return googlePois.filter((p) => inRegion(p, paddedRegion));
  }, [googlePois, paddedRegion, activeQuery]);


  const selectedPlace = useMemo(() => {

    if (!selectedPlaceId) return null;

    // 1️⃣ Temp Google-promoted place
    if (tempCrPlace && tempCrPlace.id === selectedPlaceId) {
      return tempCrPlace;
    }

    // 2️⃣ CR place
    const crPlace = crMarkers.find(p => p.id === selectedPlaceId);
    if (crPlace) {
      const googleMatch = crPlace.googlePlaceId
        ? searchMarkers.find(
            g =>
              g.source === "google" &&
              g.id === crPlace.googlePlaceId
          )
        : null;

      return {
        ...crPlace,
        googlePhotoRefs: googleMatch?.googlePhotoRefs ?? [],
        googleRating: googleMatch?.rating ?? crPlace.googleRating,
        googleUserRatingsTotal:
          googleMatch?.userRatingsTotal ?? crPlace.googleUserRatingsTotal,
        regularOpeningHours:
          googleMatch?.regularOpeningHours ?? crPlace.regularOpeningHours,
      };
    }

    // 3️⃣ Google-only place
    return searchMarkers.find(p => p.id === selectedPlaceId) || null;
  }, [selectedPlaceId, crMarkers, searchMarkers, tempCrPlace]);


  /* ------------------------------------------------------------ */
  /* ROUTING                                                      */
  /* ------------------------------------------------------------ */

  async function handleRoute(place) {
    routeRequestId.current += 1;
    const requestId = routeRequestId.current;

    setRoutingActive(true);
    setRouteDestination(place);
    await buildRoute({ destinationOverride: place, requestId });
    routeFittedRef.current = false; // Need to see if this works. Might need to go BEFORE buildRoute
  }

  function getActiveDestination() {
    if (!routeDestination) return null;

    // 1️⃣ Temp promoted Google place
    if (tempCrPlace?.id === routeDestination) {
      return tempCrPlace;
    }

    // 2️⃣ Any CR place (NOT region-filtered)
    const cr = crPlaces.find(p => p.id === routeDestination);
    if (cr) return cr;

    // 3️⃣ Fallback: selectedPlace (edge safety)
    if (selectedPlace?.id === routeDestination) {
      return selectedPlace;
    }

    return null;
  }

  async function buildRoute({ destinationOverride = null, requestId } = {}) {
    if (!userLocation) return;

    const destination =
      destinationOverride ||
      routeDestination ||
      null;

    if (!destination && waypoints.length === 0) return;

    // ─────────────────────────────
    // Determine final destination
    // ─────────────────────────────
    const finalDestination = destination
      ? {
          latitude: destination.latitude,
          longitude: destination.longitude,
        }
      : {
          latitude: waypoints[waypoints.length - 1].lat,
          longitude: waypoints[waypoints.length - 1].lng,
        };

    // ─────────────────────────────
    // Intermediates
    // ─────────────────────────────
    const intermediates = destination
      ? waypoints
      : waypoints.slice(0, -1);

    const result = await fetchRoute({
      origin: manualStartPoint || userLocation,
      destination: finalDestination,
      waypoints: intermediates.map(wp => ({
        latitude: wp.lat,
        longitude: wp.lng,
      })),
    });

    if (result?.distance) {
      setRouteDistanceMeters(result.distance);
    }

    if (!result?.polyline) return;
    if (requestId !== routeRequestId.current) return;

    const decoded = decode(result.polyline).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));

    setRouteCoords(decoded);
    // 🔑 ADD THIS
    setRouteMeta({
      distanceMeters: result.distanceMeters ?? result.distance,
      durationSeconds: result.durationSeconds ?? result.duration,
    });

    if (!routeFittedRef.current) {
      routeFittedRef.current = true;

      mapRef.current?.fitToCoordinates(decoded, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
    setLastEncodedPolyline(result.polyline);
  
  }

  async function loadSavedRouteById(routeId) {
    const ref = doc(db, "routes", routeId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("[MAP] saved route not found", routeId);
      return;
    }

    const route = snap.data();

    loadSavedRoute(route);
  }

  function loadSavedRoute(route) {
    clearRoute();
    clearWaypoints();

    // Waypoints (normalise + rebuild)
    if (Array.isArray(route.waypoints)) {
      const normalisedWaypoints = route.waypoints.map((wp) => ({
        latitude: wp.latitude ?? wp.lat,
        longitude: wp.longitude ?? wp.lng,
        title: wp.title ?? null,
        source: wp.source ?? "saved",
      }));

      normalisedWaypoints.forEach((wp) => {
        addFromPlace(wp);
      });
    }
    if (route.destination) {
      setRouteDestination({
        latitude: route.destination.latitude ?? route.destination.lat,
        longitude: route.destination.longitude ?? route.destination.lng,
        title: route.destination.title ?? null,
        id: route.destination.placeId ?? null,
      });
    }

    if (route.routePolyline) {
      const decoded = decode(route.routePolyline).map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));

      setRouteCoords(decoded);

      // 🔑 use the pending-fit system you already built
      pendingFitRef.current = decoded;
      attemptRouteFit();
    }

    setRoutingActive(true);
  }

  function handleNavigate(placeOverride = null) {
    const destination = placeOverride || routeDestination;

    if (!userLocation) return;

    // ─────────────────────────────
    // Case 1: Destination exists
    // ─────────────────────────────
    if (destination) {
      // No waypoints → simple navigation
      if (!waypoints.length) {
        openNativeNavigation({
          destination: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        });
        return;
      }

      // Waypoints → intermediates + destination
      openNavigationWithWaypoints({
        origin: userLocation,
        waypoints: [
          ...waypoints.map(wp => ({
            lat: wp.lat,
            lng: wp.lng,
            title: wp.title,
          })),
          {
            lat: destination.latitude,
            lng: destination.longitude,
            title: destination.title || "Destination",
          },
        ],
      });
      return;
    }

    // ─────────────────────────────
    // Case 2: No destination, waypoints only
    // (navigate to last waypoint)
    // ─────────────────────────────
    if (waypoints.length) {
      openNavigationWithWaypoints({
        origin: userLocation,
        waypoints: waypoints.map(wp => ({
          lat: wp.lat,
          lng: wp.lng,
          title: wp.title,
        })),
      });
    }
  }

  function attemptRouteFit() {
    if (!mapRef.current) return;
    if (!mapReadyRef.current) return;
    if (!pendingFitRef.current) return;

    mapRef.current.fitToCoordinates(pendingFitRef.current, {
      edgePadding: { top: 80, right: 80, bottom: 140, left: 80 },
      animated: true,
    });

    pendingFitRef.current = null;
    routeFittedRef.current = true;
  }

  function findNearbyCrPlace(lat, lng, places, thresholdMeters = 40) {
    return places.find(place => {
      const dLat = lat - place.latitude;
      const dLng = lng - place.longitude;

      // rough distance check (good enough at small radius)
      const distanceMeters = Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
      return distanceMeters <= thresholdMeters;
    }) || null;
  }

  /* ------------------------------------------------------------ */
  /* RENDER                                                       */
  /* ------------------------------------------------------------ */
  const renderMarker = (poi) => {
    const category = poi.category || "unknown";
    const icon = getIconForCategory(category);

    const isCr = poi.source === "cr" && !poi._temp;
    const isDestination = routeDestination && poi.id === routeDestination;
    const isTemp = !!poi._temp;

    const isSearchHitCR = activeQuery && isCr && matchesQuery(poi, activeQuery);
    const isSearchHitGoogle = activeQuery && !isCr && matchesQuery(poi, activeQuery);

    let markerMode = "default";
    if (isDestination) markerMode = "destination";
    else if (isSearchHitCR) markerMode = "searchCR";
    else if (isSearchHitGoogle) markerMode = "searchGoogle";
    else if (isCr) markerMode = "cr";
    else if (isTemp) markerMode = "temp";

    const markerStyles = {
      destination: {
        fill: theme.colors.primary,
        circle: theme.colors.accentMid,
        stroke: theme.colors.danger,
      },
      searchCR: {
        fill: theme.colors.accent,
        circle: theme.colors.accentLight,
        stroke: theme.colors.primaryLight,
      },
      searchGoogle: {
        fill: theme.colors.primaryMid,
        circle: theme.colors.accentLight,
        stroke: theme.colors.primaryDark,
      },
      cr: {
        fill: theme.colors.accentMid,
        circle: theme.colors.accentLight,
        stroke: theme.colors.accentDark,
      },
      temp: {
        fill: theme.colors.primaryMid,
        circle: theme.colors.accentDark,
        stroke: theme.colors.primaryDark,
      },
      default: {
        fill: theme.colors.primaryMid,
        circle: theme.colors.accentDark,
        stroke: theme.colors.primaryDark,
      },
    };

    const { fill, circle, stroke } = markerStyles[markerMode];

    return (
      <Marker
        key={`${poi.source}-${poi.id}`}
        coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
        onPress={(e) => {
          e.stopPropagation?.();
          if (poi.source === "google") {
            if (!capabilities.canSearchGoogle) return;
            const temp = promoteGoogleToTempCr(poi);
            if (temp) setSelectedPlaceId(temp.id);
            return;
          }

          setSelectedPlaceId(poi.id);
        }}
        anchor={{ x: 0.5, y: 1 }}
        zIndex={isDestination ? 1000 : 1}
      >
        <SvgPin icon={icon} fill={fill} circle={circle} stroke={stroke} />
      </Marker>
    );
  };

  return (
    <View style={styles.container}>
      {userLocation ? (
        <MapView
          ref={mapRef}
          key={mapKey}
          style={StyleSheet.absoluteFill}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={() => {
            if (showFilters) {
              setShowFilters(false);
              return;
            }
            if (!routeCoords.length) {
              setSelectedPlaceId(null);
              clearTempIfSafe();
            }
          }}
          onPanDrag={() => {
            if (followUser) setFollowUser(false);
          }}
          onLongPress={async (e) => {
            if (!capabilities.canCreateRoutes) return;

            const { latitude, longitude } = e.nativeEvent.coordinate;

            const nearbyCrPlace = findNearbyCrPlace(
              latitude,
              longitude,
              crPlaces
            );

            let label = null;

            if (nearbyCrPlace) {
              label = nearbyCrPlace.title || nearbyCrPlace.name;
            } else {
              try {
                label = await getPlaceLabel(latitude, longitude);
              } catch (err) {
                console.warn("[MAP] getPlaceLabel failed", err);
              }
            }

            const payload = {
              latitude,
              longitude,
              geocodeResult: label,
            };

            setPendingMapPoint(payload);
            setShowAddPointMenu(true);
          }}

          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}      
          onMapReady={() => {
            mapReadyRef.current = true;
            attemptRouteFit();
          }}
        >

          {crMarkers.map(renderMarker)}
          {searchMarkers.map(renderMarker)}
          {manualStartPoint && (
            <Marker
              coordinate={manualStartPoint}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={950}
            >
              <SvgPin
                icon="flag-checkered"
                fill={theme.colors.accent}
                circle={theme.colors.primaryMid}
                stroke={theme.colors.primaryDark}
              />
            </Marker>
          )}

          {capabilities.canCreateRoutes &&
            waypoints.map((wp, index) => (
              <Marker
                key={`wp-${index}`}
                coordinate={{ latitude: wp.lat, longitude: wp.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={500}
                tracksViewChanges={false}
              >
                <View style={styles.waypointPin}>
                  <Text style={styles.waypointIndex}>{index + 1}</Text>
                </View>
              </Marker>
            ))}

            {/* Base route */}
              <Polyline
                key={`base-${routeVersion}`}
                coordinates={routeCoords}
                strokeWidth={6}
                strokeColor={theme.colors.primaryMuted}
                zIndex={900}
              />

            {/* Active route */}
              <Polyline
                key={`active-${routeVersion}`}
                coordinates={routeCoords}
                strokeWidth={3}
                strokeColor={theme.colors.primary}
                zIndex={1000}
              />
        </MapView>
      ) : (
        <View style={{ flex: 1 }} />  // or a spinner/skeleton later
      )}      
      {showFilters && (
        <View style={styles.filterPanel}>
          <ScrollView
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
            showsVerticalScrollIndicator={false}
          >
           
            {/* SUITABILITY */}
            <Text style={styles.filterSection}>Suitability</Text>
            <View style={styles.iconGrid}>
              {FILTER_SUITABILITIES.map((a) => {
                const active = draftFilters.suitability.has(a.key);

                return (
                  <TouchableOpacity
                    key={a.key}
                    style={[
                      styles.iconButton,
                      active && styles.iconButtonActive,
                    ]}
                    onPress={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        suitability: toggleFilter(prev.suitability, a.key),
                      })
                    )}
                  >
                    <MaterialCommunityIcons
                      name={SUITABILITY_ICON_MAP[a.key] || "check"}
                      size={22}
                      color={active ? theme.colors.accent : theme.colors.background}
                    />
                    <Text
                      style={[
                        styles.iconLabel,
                        active && styles.iconLabelActive,
                      ]}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            

            {/* CATEGORIES */}
            <Text style={styles.filterSection}>Categories</Text>
            <View style={styles.iconGrid}>
              {FILTER_CATEGORIES.map((c) => {
                const active = draftFilters.categories.has(c.key);

                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.iconButton,
                      active && styles.iconButtonActive,
                    ]}
                    onPress={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        categories: toggleFilter(prev.categories, c.key),
                      }))
                    }
                  >
                    <SvgPin
                      icon={c.icon}
                      size={32}
                      fill={active ? theme.colors.accent : theme.colors.primaryLight}
                      circle={active ? theme.colors.accent : theme.colors.accentDark}
                      stroke={active ? theme.colors.primaryDark : theme.colors.primaryDark}
                    />

                    <Text
                      style={[
                        styles.iconLabel,
                        active && styles.iconLabelActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* AMENITIES */}
            <Text style={styles.filterSection}>Amenities</Text>
            <View style={styles.iconGrid}>
              {FILTER_AMENITIES.map((a) => {
                const active = draftFilters.amenities.has(a.key);

                return (
                  <TouchableOpacity
                    key={a.key}
                    style={[
                      styles.iconButton,
                      active && styles.iconButtonActive,
                    ]}
                    onPress={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        amenities: toggleFilter(prev.amenities, a.key),
                      })
                    )}
                  >
                    <MaterialCommunityIcons
                      name={AMENITY_ICON_MAP[a.key] || "check"}
                      size={22}
                      color={active ? theme.colors.accent : theme.colors.background}
                    />
                    <Text
                      style={[
                        styles.iconLabel,
                        active && styles.iconLabelActive,
                      ]}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={styles.filterClear}
            onPress={() => {
              setDraftFilters(EMPTY_FILTERS);
              setAppliedFilters(EMPTY_FILTERS);
              setShowFilters(false);
            }}
          >
            <Text style={styles.filterClearText}>Clear filters</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterDone}
            onPress={() => {
              setAppliedFilters(draftFilters);
              setShowFilters(false);
            }}
          >
            <Text style={styles.filterDoneText}>Done</Text>
          </TouchableOpacity>

        </View>
      )}
      
      {searchNotice && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{searchNotice.title}</Text>
          <Text style={styles.noticeText}>{searchNotice.message}</Text>
        </View>
      )}
      {postbox && (
        <View style={styles.postbox}>
          <Text style={styles.postboxTitle}>{postbox.title}</Text>
          <Text style={styles.postboxText}>{postbox.message}</Text>
        </View>
      )}

      <WaypointsList
        waypoints={displayWaypoints}
        onClearAll={clearNavigationIntent}
      />

      {hasRouteIntent && (
        <TouchableOpacity
          style={styles.saveRouteButton}
          onPress={() => handleSaveRoute(null)}
        >
          <MaterialCommunityIcons
            name="map-marker-path"
            size={22}
            color={theme.colors.primaryDark}
          />
          <Text style={styles.saveRouteButtonText}>Save</Text>
        </TouchableOpacity>
      )}

      {hasRouteIntent && (
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => handleNavigate(null)}
        >
          <MaterialCommunityIcons
            name="navigation"
            size={22}
            color={theme.colors.text}
          />
          <Text style={styles.navigateButtonText}>Navigate</Text>
        </TouchableOpacity>
      )}

      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={(query) => {
          setActiveQuery(query);
          setSearchOrigin(mapRegion);
        }}
        onClear={clearSearch}
        onFilterPress={() => setShowFilters(true)}
        filtersActive={filtersActive}
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
          onPlaceCreated={(name, newCrId) => {
            // Show feedback
            setPostbox({
              title: "Place added",
              message: `${name} has been added to Coffee Rider`,
            });

            // Switch selection to the real CR place
            setSelectedPlaceId(newCrId);
          }}
          onAddWaypoint={(placeArg) => {
            addFromPlace(placeArg);
          }}
        />
      )}

      <Modal visible={showAddPointMenu} transparent animationType="fade">
        <View style={styles.pointMenuOverlay}>
          <View style={styles.pointMenu}>
            <Pressable
              onPress={handleAddWaypoint}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
                <Text style={styles.pointMenuText}>Add waypoint</Text>
            </Pressable>

            <Pressable
              onPress={handleSetStart}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <Text style={styles.pointMenuText}>Add as start point</Text>
            </Pressable>

            <Pressable
              onPress={handleSetDestination}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <Text style={styles.pointMenuText}>Add as destination</Text>
            </Pressable>

            <Pressable
              onPress={closeAddPointMenu}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <Text style={styles.pointMenuCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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

  noticeBox: {
    position: "absolute",
    top: 70,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#1f2937", // dark slate
    zIndex: 2000,
    elevation: 6,
  },

  noticeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fbbf24", // amber
    marginBottom: 2,
  },

  noticeText: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  postbox: {
    position: "absolute",
    top: 70,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.secondaryMid, // dark green
    zIndex: 9999,
    elevation: 6,
  },

  postboxTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6ee7b7", // mint
    marginBottom: 2,
  },

  postboxText: {
    fontSize: 13,
    color: "#ecfdf5",
  },
  
  filterPanel: {
    position: "absolute",
    top: 60,
    right: 12,
    bottom: 100,
    width: 220,
    //backgroundColor: theme.colors.primaryMid || "rgba(15,23,42,0.8)",
    padding: 12,
    borderRadius: 16,
    zIndex: 3000,
    elevation: 8,
    backgroundColor: theme.colors.surfaceOverlay || "rgba(15,23,42,0.8)",
  },

  filterSection: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.accentMid,
  },

  filterRow: {
    paddingVertical: 10,
  },

  filterLabel: {
    fontSize: 14,
    color: theme.colors.primaryLight,
  },

  filterLabelActive: {
    color: theme.colors.accentMid,
    fontWeight: "600",
  },

  filterClear: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
  },

  filterClearText: {
    color: theme.colors.primaryDark,
  },

  filterDone: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
  },

  filterDoneText: {
    color: theme.colors.accentDark,
    fontWeight: "600",
  },

  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  iconButton: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
  },

  iconButtonActive: {
    backgroundColor: theme.colors.surfaceHighlight,
  },

  iconLabel: {
    marginTop: 4,
    fontSize: 11,
    color: theme.colors.accentDark,
    textAlign: "center",
  },

  iconLabelActive: {
    color: theme.colors.accentMid,
    fontWeight: "600",
  },

  navigateButton: {
    position: "absolute",
    right: 16,
    bottom: 110, // above tab bar
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    elevation: 6,
    zIndex: 2500,
  },

  navigateButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },

  saveRouteButton: {
    position: "absolute",
    right: 16,
    bottom: 160, // above tab bar
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: theme.colors.accent,
    elevation: 6,
    zIndex: 2500,
  },

  saveRouteButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.primaryDark,
  },


  waypointPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563eb", // map blue
    justifyContent: "center",
    alignItems: "center",
  },

  waypointIndex: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
  },

  pointMenuOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  pointMenu: {
    width: "80%",
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 14,
    padding: 14,
    elevation: 8,
  },

  pointMenuItem: {
    paddingVertical: 14,
    borderRadius: 10,
  },

  pointMenuText: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: "500",
  },

  pointMenuCancel: {
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: theme.colors.primaryDark,
  },

  pointMenuCancelText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    opacity: 0.8,
  },

});




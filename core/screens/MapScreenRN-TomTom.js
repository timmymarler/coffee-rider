import { db } from "@config/firebase";
import { RoutingPreferencesContext } from "@context/RoutingPreferencesContext";
import { TabBarContext } from "@context/TabBarContext";
import { debugLog } from "@core/utils/debugLog";
import { incMetric } from "@core/utils/devMetrics";
import Constants from "expo-constants";
import { collection, doc, getDocs, onSnapshot, updateDoc } from "firebase/firestore";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View, useColorScheme } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MiniMap from "../map/components/MiniMap";
import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

import * as KeepAwake from "expo-keep-awake";
import * as Location from "expo-location";
import { classifyPoi } from "../map/classify/classifyPois";
import { applyFilters } from "../map/filters/applyFilters";
/* Ready for routing */
import MapRouteTypeSelector from "@core/components/routing/MapRouteTypeSelector";
import { decode } from "@mapbox/polyline";
import { SearchBar } from "../map/components/SearchBar";
import { fetchTomTomRoute } from "../map/utils/tomtomRouting";

import { saveRide } from "@/core/map/routes/saveRide";
import { saveRoute } from "@/core/map/routes/saveRoute";
import { openNavigationWithWaypoints } from "@/core/map/utils/navigation";
import { AuthContext } from "@context/AuthContext";
import { GOOGLE_PHOTO_LIMITS } from "@core/config/photoPolicy";
import { useNetworkStatus } from "@core/hooks/useNetworkStatus";
import useActiveRide from "@core/map/routes/useActiveRide";
import useActiveRideLocations from "@core/map/routes/useActiveRideLocations";
import useWaypoints from "@core/map/waypoints/useWaypoints";
import { WaypointsContext } from "@core/map/waypoints/WaypointsContext";
import WaypointsList from "@core/map/waypoints/WaypointsList";
import { getCapabilities } from "@core/roles/capabilities";
import { cacheRoute, getCachedRoute } from "@core/utils/routeCache";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import theme from "@themes";
import { useRouter } from "expo-router";
import { getDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { RIDER_AMENITIES } from "../config/amenities/rider";
import { RIDER_CATEGORIES } from "../config/categories/rider";
import { RIDER_SUITABILITY } from "../config/suitability/rider";
import { geocodeAddress, getPlaceLabel } from "../lib/geocode";

const mapStyleLight = require("@config/mapStyleLight.json");
const mapStyleDark = require("@config/mapStyleDark.json");

const RECENTER_ZOOM = Platform.OS === "ios" ? 2.5 : 13; // Android: 13, iOS: 2.5
const FOLLOW_ZOOM = Platform.OS === "ios" ? 7 : 17; // Android: 17, iOS: 7 - More zoomed in for better detail
const ENABLE_GOOGLE_AUTO_FETCH = true;

// Follow Me smoothing constants
const MAX_LOCATION_ACCURACY = 25; // Meters - ignore readings worse than this
const MIN_LOCATION_MOVE_DISTANCE = 3; // Meters - ignore updates < 3m away

/* ------------------------------------------------------------------ */
/* UTILITY FUNCTIONS                                                  */
/* ------------------------------------------------------------------ */

// Project a point onto a line segment (polyline snapping)
function projectPointToPolyline(point, polylineCoords) {
  if (!polylineCoords || polylineCoords.length < 2) return null;
  
  let closestPoint = null;
  let minDistance = Infinity;
  
  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const p1 = polylineCoords[i];
    const p2 = polylineCoords[i + 1];
    
    // Vector from p1 to p2
    const dx = p2.longitude - p1.longitude;
    const dy = p2.latitude - p1.latitude;
    
    // Vector from p1 to point
    const px = point.longitude - p1.longitude;
    const py = point.latitude - p1.latitude;
    
    // Project point onto segment
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    
    const projectedLat = p1.latitude + t * dy;
    const projectedLng = p1.longitude + t * dx;
    
    // Distance from point to projection
    const dist = Math.sqrt((point.latitude - projectedLat) ** 2 + (point.longitude - projectedLng) ** 2) * 111000; // Approx meters
    
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = { latitude: projectedLat, longitude: projectedLng };
    }
  }
  
  // Only snap if within reasonable distance (50m)
  return minDistance < 50 ? closestPoint : null;
}

// Calculate distance between two points in meters
function distanceBetween(p1, p2) {
  const lat1 = p1.latitude, lon1 = p1.longitude;
  const lat2 = p2.latitude, lon2 = p2.longitude;
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ------------------------------------------------------------------ */
/* CATEGORY → ICON MAP                                                */
/* ------------------------------------------------------------------ */
const SUITABILITY_ICON_MAP = {
  bikers: "motorbike",
  scooters: "moped",
  cyclists: "bike",
  walkers: "walk",
  cars: "car",
  evs: "car-electric",
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
  camping: "tent",
  accommodation: "bed-outline",
  unknown: "map-marker",
};


const AMENITY_ICON_MAP = {
  parking: "parking",
  outdoor_seating: "table-picnic",
  toilets: "toilet",
  disabled_access: "wheelchair-accessibility",
  pet_friendly: "dog-side",
  ev_charger: "ev-plug-ccs2",
};

  // Maneuver → icon + label map (simplified)
  const MANEUVER_ICON_MAP = {
    TURN_LEFT: { icon: "arrow-left-bold", label: "Turn left" },
    TURN_RIGHT: { icon: "arrow-right-bold", label: "Turn right" },
    TURN_SLIGHT_LEFT: { icon: "arrow-left-top-bold", label: "Slight left" },
    TURN_SLIGHT_RIGHT: { icon: "arrow-right-top-bold", label: "Slight right" },
    STRAIGHT: { icon: "arrow-up-bold", label: "Continue straight" },
    ROUNDABOUT_ENTER: { icon: "rotate-right", label: "Enter roundabout" },
    ROUNDABOUT_EXIT: { icon: "rotate-right", label: "Exit roundabout" },
    ROUNDABOUT_ENTER_LEFT: { icon: "rotate-left", label: "Enter roundabout (left)" },
    ROUNDABOUT_EXIT_LEFT: { icon: "rotate-left", label: "Exit roundabout (left)" },
    ROUNDABOUT_ENTER_RIGHT: { icon: "rotate-right", label: "Enter roundabout (right)" },
    ROUNDABOUT_EXIT_RIGHT: { icon: "rotate-right", label: "Exit roundabout (right)" },
    ROUNDABOUT_CROSS: { icon: "rotate-right", label: "Proceed through roundabout" },
    MERGE_LEFT: { icon: "arrow-left-bottom", label: "Merge left" },
    MERGE_RIGHT: { icon: "arrow-right-bottom", label: "Merge right" },
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
  sponsor: false,
};

const DEFAULT_FILTERS = {
  suitability: [],
  categories: [],
  amenities: [],
  sponsor: false,
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

// Format distance in Miles and Yards (no feet)
function formatDistanceImperial(meters) {
  if (meters == null) return "";
  const miles = meters / 1609.344;
  if (miles >= 0.1) {
    const digits = miles >= 10 ? 0 : 1;
    return `${miles.toFixed(digits)} mi`;
  }
  const yards = meters * 1.09361;
  return `${Math.round(yards)} yd`;
}

// Approximate distance between two lat/lng points in meters
function distanceBetweenMeters(a, b) {
  if (!a || !b) return null;
  const dx = (a.latitude - b.latitude) * 111320;
  const dy =
    (a.longitude - b.longitude) *
    (40075000 * Math.cos((a.latitude * Math.PI) / 180)) /
    360;
  return Math.sqrt(dx * dx + dy * dy);
}

// Ramer-Douglas-Peucker polyline simplification algorithm
// Reduces points while maintaining visual accuracy
function simplifyPolyline(points, tolerance = 0.00005) {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    
    // Distance from point to line segment
    const num = Math.abs(
      (end.longitude - start.longitude) * (start.latitude - p.latitude) -
      (start.longitude - p.longitude) * (end.latitude - start.latitude)
    );
    
    const den = Math.sqrt(
      Math.pow(end.longitude - start.longitude, 2) +
      Math.pow(end.latitude - start.latitude, 2)
    );
    
    const distance = num / den;

    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // Recursively simplify
  if (maxDistance > tolerance) {
    const recursive1 = simplifyPolyline(points.slice(0, maxIndex + 1), tolerance);
    const recursive2 = simplifyPolyline(points.slice(maxIndex), tolerance);
    return recursive1.slice(0, -1).concat(recursive2);
  } else {
    return [start, end];
  }
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

function isExactMatch(place, query) {
  if (!query) return false;
  const q = query.toLowerCase();
  const title = place.title?.toLowerCase() || "";
  
  // Exact match if title starts with query or is exact word match
  return title.startsWith(q);
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
          .map((p) => p.name)
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

    return mapped;
  }

  const mapped = (attempt.places || [])
    .map(p => mapGooglePlace(p, capabilities))
    .filter(p => p.latitude && p.longitude);

  return mapped;
}

/* ------------------------------------------------------------------ */
/* UTILITY: Coordinate Normalization                                  */
/* ------------------------------------------------------------------ */

/**
 * Normalize coordinate formats from different sources
 * Handles: {lat, lng}, {latitude, longitude}, or direct values
 * Returns null if coordinates are invalid
 */
function normalizeCoord(obj) {
  if (!obj) return null;
  
  const lat = obj.latitude ?? obj.lat;
  const lng = obj.longitude ?? obj.lng;
  
  // Validate coordinates are valid numbers
  if (typeof lat !== 'number' || typeof lng !== 'number' || 
      isNaN(lat) || isNaN(lng)) {
    console.warn('[normalizeCoord] Invalid coordinates:', obj);
    return null;
  }
  
  // Validate coordinates are within valid ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.warn('[normalizeCoord] Coordinates out of bounds:', { lat, lng });
    return null;
  }
  
  return { latitude: lat, longitude: lng };
}

/* ------------------------------------------------------------------ */
/* MAIN SCREEN                                                        */
/* ------------------------------------------------------------------ */

export default function MapScreenRN({ placeId, openPlaceCard }) {
    // Open PlaceCard and zoom to marker if placeId and openPlaceCard are provided
    useEffect(() => {
      if (placeId && openPlaceCard && mapRef.current) {
        setSelectedPlaceId(placeId);
        // Find the place in crPlaces or googlePois
        let place = crPlaces.find(p => p.id === placeId) || googlePois.find(p => p.id === placeId);
        if (place && place.latitude && place.longitude) {
          mapRef.current.animateCamera({
            center: { latitude: place.latitude, longitude: place.longitude },
            zoom: 16
          }, { duration: 600 });
        }
      }
    }, [placeId, openPlaceCard, crPlaces, googlePois]);
  const mapRef = useRef();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 56; // matches FloatingTabBar height
  const FLOATING_MARGIN = 1; // sit almost flush with the tab bar
  const SAVE_BUTTON_GAP = 50; // vertical gap between save and navigate buttons

  const [crPlaces, setCrPlaces] = useState([]);
  const [googlePois, setGooglePois] = useState([]);
  const [sponsoredPlaceIds, setSponsoredPlaceIds] = useState(new Set()); // Track all places with active sponsorship

  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const filtersActive = appliedFilters.suitability.size > 0 || appliedFilters.categories.size > 0 || appliedFilters.amenities.size > 0 || appliedFilters.sponsor;
  const [userLocation, setUserLocation] = useState(null);

  const [mapRegion, setMapRegion] = useState(userLocation);

  // Selected marker/placecard
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);

  // Temporary “promoted” Google place (in-memory only)
  const [tempCrPlace, setTempCrPlace] = useState(null);

  // Routing
  const router = useRouter();
  const [routeCoords, setRouteCoords] = useState([]);

  // Newly created place (shown until it's fetched into crPlaces)
  const [newlyCreatedPlace, setNewlyCreatedPlace] = useState(null);

  const hasRoute = routeCoords.length > 0;
  const [routeMeta, setRouteMeta] = useState(null);
  const [followUser, setFollowUser] = useState(false);
  const { setMapActions, setActiveRide } = useContext(TabBarContext);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");   // what user is typing
  const [activeQuery, setActiveQuery] = useState("");   // what we are actually searching
  const [searchOrigin, setSearchOrigin] = useState(null);
  
  const auth = useContext(AuthContext);
  const user = auth?.user || null;
  const role = auth?.profile?.role || "guest";
  const capabilities = getCapabilities(role);
  
  // Get user's routing preferences
  const { 
    routeType: userRouteType, 
    travelMode: userTravelMode, 
    routeTypeMap,
    theme: currentTheme,
    getDefaultsForBrand,
    customHilliness,
    customWindingness,
  } = useContext(RoutingPreferencesContext);

  // Determine if route type is non-default
  const defaultRouteType = getDefaultsForBrand(currentTheme)?.routeType;
  const isRouteTypeNonDefault = userRouteType !== defaultRouteType;

  const [searchNotice, setSearchNotice] = useState(null);
  const [postbox, setPostbox] = useState(null);
  const isSearchActive = !!activeQuery;
  const [mapKey, setMapKey] = useState(0);
  const isLoadingSavedRouteRef = useRef(false);

  const skipNextFollowTickRef = useRef(false);
  const skipNextRegionChangeRef = useRef(false);
  const skipRegionChangeUntilRef = useRef(0);
  const skipNextRebuildRef = useRef(false); // Skip next effect rebuild (used by toggleFollowMe)
  const isAnimatingRef = useRef(false); // Track if we're doing a programmatic animation
  const followMeInactivityRef = useRef(null); // Timeout for 15-min inactivity
  const lastUserPanTimeRef = useRef(null); // Track when user last manually panned
  const previousFollowUserRef = useRef({ isTraveling: false, polyline: [] }); // Track previous Follow Me state and stored polyline
  const {
    waypoints,
    addFromPlace,
    addFromMapPress,
    formatPoint,
    clearWaypoints,
  } = useWaypoints();
  
  // Get direct access to context for addWaypointAtStart
  const { addWaypointAtStart } = useContext(WaypointsContext);
  
  const [routingActive, setRoutingActive] = useState(false);
  const [routeDestination, setRouteDestination] = useState(null);
  const [isHomeDestination, setIsHomeDestination] = useState(false);
  const [routeClearedByUser, setRouteClearedByUser] = useState(false);
  const routeRequestId = useRef(0);
  const [routeVersion, setRouteVersion] = useState(0);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [nextJunctionDistance, setNextJunctionDistance] = useState(null);
  const routeFittedRef = useRef(false);
  
  // Active ride & location sharing
  const { activeRide, endRide } = useActiveRide(user);
  const { riderLocations } = useActiveRideLocations(activeRide, user?.uid);
  
  // Navigation mode is active when Follow Me is enabled OR user is on an active ride
  const isNavigationMode = followUser || !!activeRide;
  
  // Sync activeRide to TabBarContext so floating tab bar can access it
  useEffect(() => {
    setActiveRide(activeRide);
    activeRideRef.current = activeRide;
    endRideRef.current = endRide;
    
    // When an active ride starts, rebuild the route with current location as origin
    if (activeRide && routeDestination && userLocation && !followUser) {
      const requestId = ++routeRequestId.current;
      mapRoute({
        origin: userLocation,
        waypoints: waypoints,
        destination: routeDestination,
        travelMode: userTravelMode,
        routeType: userRouteType,
        requestId,
        skipFitToView: false, // Fit to view for active rides so user sees full route
      }).catch(error => {
        console.warn('[MapScreenRN] Error rebuilding route for active ride:', error);
      });
    }
  }, [activeRide, endRide, setActiveRide, routeDestination, userLocation, followUser, waypoints, userTravelMode, userRouteType]);
  
  const canSaveRoute = 
    capabilities.canSaveRoutes &&
    routeMeta &&
    (routeDestination || waypoints.length > 0);
  const [lastEncodedPolyline, setLastEncodedPolyline] = useState(null);

  const [showSaveRouteModal, setShowSaveRouteModal] = useState(false);
  const [saveRouteName, setSaveRouteName] = useState("");
  const [currentLoadedRouteId, setCurrentLoadedRouteId] = useState(null);

  const [showSaveRideModal, setShowSaveRideModal] = useState(false);
  const [saveRideName, setSaveRideName] = useState("");
  const [pendingRidePolyline, setPendingRidePolyline] = useState(null);
  const [viewedRideId, setViewedRideId] = useState(null); // Track if viewing a saved ride

  const {
    pendingSavedRouteId,
    setPendingSavedRouteId,
    enableFollowMeAfterLoad,
    setEnableFollowMeAfterLoad,
  } = useContext(WaypointsContext);
  const mapReadyRef = useRef(false);
  const pendingFitRef = useRef(null);
  const activeRideOnFocusRef = useRef(null); // Track active ride state when screen is focused
  const activeRideRef = useRef(null);
  const endRideRef = useRef(null);
  const markerPressedRef = useRef(false); // Track if a marker was just pressed
  
  // Dead reckoning: estimate position based on heading when GPS is poor
  const lastGoodGPSRef = useRef(null); // Last accurate GPS reading
  const lastGPSTimeRef = useRef(null); // Time of last GPS update
  const estimatedSpeedRef = useRef(0); // Estimated speed in m/s (from recent updates)
  const positionSmoothingRef = useRef(null); // Smoothed position for Kalman-like filtering
  const lastRouteBuildLocationRef = useRef(null); // Track location used for last route build to avoid excessive rebuilds
  const lastRouteTypeRef = useRef(null); // Track the route type used for last route build to rebuild when it changes
  const lastWaypoints = useRef([]); // Track waypoints from last route build to rebuild when they change
  const MIN_ROUTE_REBUILD_DISTANCE_METERS = 10; // Only rebuild routes if user moves more than 10 meters
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

  // Network status monitoring
  const networkStatus = useNetworkStatus();
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const offlineToastShownRef = useRef(false);

  useEffect(() => {
    // Update offline mode based on network status
    setIsOfflineMode(!networkStatus.isOnline);
    if (!networkStatus.isOnline) {
      // Show toast once when going offline
      if (!offlineToastShownRef.current) {
        ToastAndroid.show('You are offline - using cached routes', ToastAndroid.LONG);
        offlineToastShownRef.current = true;
      }
    } else {
      // Reset flag when coming back online
      offlineToastShownRef.current = false;
    }
  }, [networkStatus.isOnline]);

  const navButtonBottom = insets.bottom + TAB_BAR_HEIGHT + FLOATING_MARGIN;
  const saveButtonBottom = navButtonBottom + SAVE_BUTTON_GAP;
  const [pendingMapPoint, setPendingMapPoint] = useState(null);
  const [showAddPointMenu, setShowAddPointMenu] = useState(false);
  const [showMarkerMenu, setShowMarkerMenu] = useState(false);
  const [pendingMarker, setPendingMarker] = useState(null);
  const [showRefreshRouteMenu, setShowRefreshRouteMenu] = useState(false);
  const [showRouteTypeSelector, setShowRouteTypeSelector] = useState(false);
  const hasRouteIntent = routeDestination || waypoints.length > 0;

  const closeAddPointMenu = () => {
    setShowAddPointMenu(false);
    setPendingMapPoint(null);
  };

  const closeMarkerMenu = () => {
    setShowMarkerMenu(false);
    setPendingMarker(null);
  };

  const closeRefreshRouteMenu = () => {
    setShowRefreshRouteMenu(false);
  };

  const handleRefreshRouteToNextWaypoint = async () => {
    closeRefreshRouteMenu();

    // Must have user location and either waypoints or a destination
    if (!userLocation || (!routeDestination && waypoints.length === 0)) {
      console.warn("[REFRESH] No user location or route");
      return;
    }

    try {
      // If we have a current polyline, find the NEXT waypoint ahead to snap to
      let snapPoint = null;
      if (routeCoords && routeCoords.length >= 2) {
        // Find the closest point on current polyline
        let minDistance = Infinity;
        let closestIdx = 0;
        
        // Sample every Nth point instead of checking all points for performance
        // For a 1000-point route, this checks ~50 points instead of 1000
        const sampleInterval = Math.max(1, Math.floor(routeCoords.length / 50));
        
        for (let i = 0; i < routeCoords.length; i += sampleInterval) {
          const dist = distanceBetweenMeters(userLocation, routeCoords[i]);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = i;
          }
        }
        
        // Find the NEXT waypoint ahead of current position
        // Look ahead by ~20% of remaining route to find next waypoint
        let nextWaypointIdx = closestIdx;
        const lookAheadDistance = Math.floor(routeCoords.length * 0.2); // 20% ahead
        const searchEndIdx = Math.min(closestIdx + lookAheadDistance, routeCoords.length - 1);
        
        // Find furthest waypoint within look-ahead range (going forward on route)
        if (searchEndIdx > closestIdx) {
          nextWaypointIdx = searchEndIdx;
          snapPoint = routeCoords[nextWaypointIdx];
          const snapDistance = distanceBetweenMeters(userLocation, snapPoint);
        } else if (minDistance < 500) {
          // Fallback: if very close to current route, snap to closest point
          snapPoint = routeCoords[closestIdx];
        }
      }

      // Determine final destination (same as buildRoute logic) - normalize coordinates
      let finalDestination = null;
      if (routeDestination) {
        finalDestination = normalizeCoord(routeDestination);
        if (!finalDestination) {
          console.error('[REFRESH] Failed to normalize route destination');
          return;
        }
      } else if (waypoints.length > 0) {
        finalDestination = normalizeCoord(waypoints[waypoints.length - 1]);
        if (!finalDestination) {
          console.error('[REFRESH] Failed to normalize last waypoint');
          return;
        }
      }

      if (!finalDestination) {
        console.error('[REFRESH] No valid final destination');
        return;
      }

      // If we have a snap point, route through it to maintain the path
      let routeWaypoints = waypoints.map(wp => {
        const normalized = normalizeCoord(wp);
        return normalized || { latitude: wp.lat, longitude: wp.lng };
      });

      if (snapPoint) {
        // Insert snap point as first waypoint to guide forward on route
        routeWaypoints = [
          {
            latitude: snapPoint.latitude,
            longitude: snapPoint.longitude,
          },
          ...routeWaypoints,
        ];
      }

      // Route from current location through waypoints (including snap point if exists) to final destination
      const result = await fetchTomTomRoute(
        userLocation,
        finalDestination,
        routeWaypoints,
        userTravelMode,  // Use user's vehicle type
        userRouteType,   // Use user's route type preference
        routeTypeMap,    // Map of route type IDs to TomTom parameters
        customHilliness, // Custom hilliness for custom routes
        customWindingness // Custom windingness for custom routes
      );

      if (!result?.polyline) {
        console.warn("[REFRESH] No polyline in result");
        return;
      }

      // TomTom returns polyline as array of {latitude, longitude} objects
      const decoded = result.polyline;

      setRouteCoords(decoded);
      setRouteDistanceMeters(result.distanceMeters ?? result.distance);
      setRouteMeta({
        distanceMeters: result.distanceMeters ?? result.distance,
        durationSeconds: result.durationSeconds ?? result.duration,
      });
      setRouteSteps(result.steps ?? []);
      setCurrentStepIndex(0);

    } catch (error) {
      console.error("[REFRESH] Error refreshing route:", error);
    }
  };

  const handleAddWaypoint = () => {
    setSelectedPlaceId(null);
    isLoadingSavedRouteRef.current = false;
    console.log("[handleAddWaypoint] Adding waypoint with isStartPoint=false");
    addFromMapPress({ ...pendingMapPoint, isStartPoint: false });
    closeAddPointMenu();
  };

  const handleSetStart = () => {
    setSelectedPlaceId(null);
    console.log("[handleSetStart] Adding start point with isStartPoint=true");
    addFromMapPress({ ...pendingMapPoint, isStartPoint: true });
    closeAddPointMenu();
  };

  const handleSetDestination = () => {
    setSelectedPlaceId(null);
    isLoadingSavedRouteRef.current = false;
    const point = formatPoint(pendingMapPoint);
    setRouteDestination({
      latitude: point.lat,
      longitude: point.lng,
      title: point.title,
    });
    setIsHomeDestination(false);

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

  // End active ride when leaving map screen
  useFocusEffect(
    useCallback(() => {
      // Cleanup: Runs when screen loses focus
      return () => {
        // Use refs to access current values without creating dependencies
        if (activeRideRef.current && endRideRef.current) {
          endRideRef.current();
        }
      };
      // Empty deps - cleanup runs on blur, current values accessed via refs
    }, [])
  );

  // End active ride when app goes to background or is closed
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (activeRideRef.current && endRideRef.current) {
          endRideRef.current();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
  async function handleSaveRoute(routeName) {
    if (!routeCoords.length || !user) return;
    if (!capabilities.canSaveRoutes) {
      setPostbox({ type: "info", message: "Your account cannot save routes." });
      return;
    }
    if (!user) {
      setPostbox({
        type: "info",
        message: "You need to be logged in to save routes.",
      });
      return;
    }

    const destination = getFinalDestination();

    // If no name provided and a route is currently loaded, update it
    // If name provided or no loaded route, create a new one
    const isUpdating = !routeName && currentLoadedRouteId;

    await saveRoute({
      user,
      capabilities,
      visibility: "private", // change later via UI
      name: routeName || undefined,
      routeId: isUpdating ? currentLoadedRouteId : undefined,
      origin: waypoints.length > 0 ? {
        lat: waypoints[0].lat,
        lng: waypoints[0].lng,
      } : {
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
      // Debug: Save TomTom steps, guidance, and rawRoute for analysis
      tomtomSteps: routeSteps,
      tomtomGuidance: (routeSteps && routeSteps.length > 0 && routeSteps[0].instruction) ? undefined : undefined, // Placeholder, see below
      tomtomRawRoute: undefined, // Placeholder, see below
    });

    // Note: tomtomGuidance and tomtomRawRoute are not available in state by default.
    // If you want to save them, you need to expose them in state when building the route.
    // For now, only tomtomSteps (routeSteps) is saved. To save more, update mapRoute/buildRoute to store guidance/rawRoute in state.
    
    setPostbox({
      type: "success",
      message: isUpdating ? "Route updated successfully." : "Route saved successfully.",
    });
    setShowSaveRouteModal(false);
    setSaveRouteName("");

  }

  function getFinalDestination() {
    if (routeDestination) return routeDestination;
    if (waypoints.length > 0) return waypoints[waypoints.length - 1];
    return null;
  }

  async function handleSaveRide(rideName) {
    if (!pendingRidePolyline || !pendingRidePolyline.length || !user) return;
    if (!capabilities.canSaveRoutes) {
      setPostbox({ type: "info", message: "Your account cannot save rides." });
      return;
    }

    try {
      // If viewing a saved ride, save it as a route instead
      if (viewedRideId) {
        // Convert ride polyline to route format and save as route
        const firstPoint = pendingRidePolyline[0];
        const lastPoint = pendingRidePolyline[pendingRidePolyline.length - 1];
        
        await saveRoute({
          user,
          capabilities,
          name: rideName || "Saved Ride",
          origin: {
            latitude: firstPoint.latitude,
            longitude: firstPoint.longitude,
          },
          destination: {
            latitude: lastPoint.latitude,
            longitude: lastPoint.longitude,
            title: rideName || "Destination",
          },
          polyline: pendingRidePolyline,
          routeMeta: {
            distanceMeters: routeDistanceMeters,
            durationSeconds: routeMeta?.durationSeconds,
          },
          waypoints: [], // Rides don't have waypoints, just the polyline
        });

        setPostbox({
          type: "success",
          message: "Ride saved as route successfully!",
        });
        setViewedRideId(null);
      } else {
        // Tracking a ride - save it as a ride
        await saveRide({
          user,
          capabilities,
          name: rideName || undefined,
          polyline: pendingRidePolyline,
          routeMeta: {
            distanceMeters: routeDistanceMeters,
            durationSeconds: routeMeta?.durationSeconds,
          },
          completedAt: new Date(),
        });

        setPostbox({
          type: "success",
          message: "Ride saved successfully!",
        });
      }
      setShowSaveRideModal(false);
      setSaveRideName("");
      setPendingRidePolyline(null);
    } catch (error) {
      console.error("[handleSaveRide] Error saving ride:", error);
      setPostbox({
        type: "error",
        message: "Failed to save ride. Please try again.",
      });
    }
  }

  /* ------------------------------------------------------------ */
  /* LOAD CR PLACES                                               */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "places"), (snapshot) => {
      incMetric("MapScreen:placesSnapshot");
      incMetric("MapScreen:placesDocs", snapshot.size, 25);
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

      // 🔄 Log place updates for debugging
      if (newlyCreatedPlace) {
        const isNewPlaceInList = places.find(p => p.id === newlyCreatedPlace.id);
      }
      
      if (selectedPlaceId) {
        const updatedPlace = places.find(p => p.id === selectedPlaceId);
        if (updatedPlace) {
          console.log("[MapScreenRN] 🔄 Updated selected place from listener:", {
            placeId: updatedPlace.id,
            name: updatedPlace.title,
            category: updatedPlace.category,
            amenities: updatedPlace.amenities,
            suitability: updatedPlace.suitability,
          });
        }
      }

      setCrPlaces(places);
    }, (err) => {
      // Ignore permission errors when user is logging out
      if (err.code !== 'permission-denied') {
        console.error("[MapScreenRN] Error listening to places:", err);
      }
    });

    return unsub;
  }, [selectedPlaceId]);

  // Load sponsorship data from users to identify sponsored places
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const sponsoredIds = new Set();
      const now = Date.now();

      snapshot.docs.forEach((doc) => {
        const userData = doc.data();
        const sponsorship = userData?.sponsorship;
        const linkedPlaceId = userData?.linkedPlaceId;

        // Check if user has active sponsorship
        if (sponsorship?.isActive && linkedPlaceId) {
          const validTo = sponsorship.validTo?.toMillis?.() || sponsorship.validTo;
          // Only include if sponsorship hasn't expired
          if (validTo && validTo > now) {
            sponsoredIds.add(linkedPlaceId);
          }
        }
      });

      setSponsoredPlaceIds(sponsoredIds);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.error("[MapScreenRN] Error listening to users:", err);
      }
    });

    return unsub;
  }, []);

  // Monitor newly created places and ensure they're in crPlaces
  useEffect(() => {
    if (!newlyCreatedPlace) return;

    const checkNewPlace = async () => {
      try {
        // Small delay to allow Firestore to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const newPlaceInList = crPlaces.find(p => p.id === newlyCreatedPlace.id);
        if (!newPlaceInList) {
          // Force refresh by querying places directly
          const placesSnapshot = await getDocs(collection(db, "places"));
          const refreshedPlaces = placesSnapshot.docs.map((doc) => {
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
              suitability: Array.isArray(data.suitability)
                ? data.suitability
                : Object.keys(data.suitability || {}),
              amenities: Array.isArray(data.amenities)
                ? data.amenities
                : Object.keys(data.amenities || {}),
            };
          });
          setCrPlaces(refreshedPlaces);
          console.log("[MapScreenRN] ✓ Refreshed crPlaces, total:", refreshedPlaces.length);
        } else {
          console.log("[MapScreenRN] ✓ Newly created place found in crPlaces");
        }
      } catch (err) {
        console.error("[MapScreenRN] Error checking new place:", err);
      }
    };

    checkNewPlace();
  }, [newlyCreatedPlace]);

  /* ------------------------------------------------------------ */
  /* USER LOCATION                                                */
  /* ------------------------------------------------------------ */
  async function ensureUserLocation() {
    if (userLocation) return userLocation;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPostbox({
          type: "warning",
          title: "Location Required",
          message: "Location permission is required to use this feature. Please enable it in your device settings."
        });
        return null;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation(current.coords);
      return current.coords;
    } catch (e) {
      setPostbox({
        type: "error",
        title: "Location Error",
        message: "Unable to determine your current location. Please check your settings."
      });
      return null;
    }
  }

  async function recenterOnUser({ zoom = null, heading = null, pitch = null } = {}) {
    if (!mapRef.current) return;

    const coords = await ensureUserLocation();
    if (!coords) return;

    isAnimatingRef.current = true;
    
    // Build camera config with platform-specific zoom handling
    let cameraConfig = {
      center: { latitude: coords.latitude, longitude: coords.longitude },
      ...(heading !== null ? { heading } : {}),
      ...(pitch !== null ? { pitch } : {}),
    };
    
    // iOS uses altitude (in meters), Android uses zoom level
    if (zoom !== null) {
      if (Platform.OS === "ios") {
        // Convert zoom level to altitude for iOS
        // Lower altitude = closer/more zoomed in
        // zoom 28 ≈ ~100m altitude, zoom 12 ≈ ~5000m altitude
        cameraConfig.altitude = Math.pow(2, 13 - zoom) * 10;
      } else {
        cameraConfig.zoom = zoom;
      }
    }
    
    mapRef.current.animateCamera(cameraConfig, { duration: 350 });
    
    // Reset flag after animation completes
    setTimeout(() => { isAnimatingRef.current = false; }, 500);
    // Debounce region change disables for 2 seconds after recenter
    skipRegionChangeUntilRef.current = Date.now() + 2000;
  }

  function handleRecentre() {
    // Always reset to normal zoom and no tilt
    skipNextRegionChangeRef.current = true;
    recenterOnUser({ zoom: RECENTER_ZOOM, pitch: 0 });
  }

  function clearFollowMeInactivityTimeout() {
    if (followMeInactivityRef.current) {
      clearTimeout(followMeInactivityRef.current);
      followMeInactivityRef.current = null;
    }
  }

  function resetFollowMeInactivityTimeout() {
    clearFollowMeInactivityTimeout();
    if (followUser) {
      followMeInactivityRef.current = setTimeout(() => {
        setFollowUser(false);
      }, 15 * 60 * 1000); // 15 minutes
    }
  }

  /* ------------------------------------------------------------ */
  /* FOLLOW MODE                                                  */
  /* ------------------------------------------------------------ */
  async function toggleFollowMe() {
    // Turning OFF: clear inactivity timeout and revert camera
    if (followUser) {
      setFollowUser(false);
      clearFollowMeInactivityTimeout();
      // Revert to normal zoom and no tilt
      skipNextRegionChangeRef.current = true;
      skipRegionChangeUntilRef.current = Date.now() + 2000;
      await recenterOnUser({ zoom: RECENTER_ZOOM, pitch: 0 });
      return;
    }

    // Turning ON: Route from current location through waypoints to destination
    console.log("[toggleFollowMe] Attempting to start Follow Me");
    console.log("[toggleFollowMe] Current waypoints:", waypoints.length, "waypoints");
    waypoints.forEach((wp, idx) => {
      console.log(`  [${idx}] ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)} - isStartPoint: ${wp.isStartPoint}, title: ${wp.title}`);
    });
    console.log("[toggleFollowMe] Destination:", routeDestination ? `${routeDestination.latitude.toFixed(5)}, ${routeDestination.longitude.toFixed(5)}` : "none");
    
    if (waypoints.length > 0) {
      // Clear the loaded route ID since we're converting to a recalculated Follow Me route
      setCurrentLoadedRouteId(null);
      
      // Set followUser=true FIRST so that when state updates trigger MAP_EFFECT,
      // buildRoute will use the correct Follow Me logic (current location as origin)
      setFollowUser(true);
      
      // Add current location as first waypoint (unless it's already there as a start point)
      const firstIsStartPoint = waypoints[0]?.isStartPoint === true;
      const distanceToFirst = waypoints[0] ? 
        Math.sqrt(
          Math.pow(userLocation.latitude - waypoints[0].lat, 2) +
          Math.pow(userLocation.longitude - waypoints[0].lng, 2)
        ) : Infinity;
      
      // Only prepend current location if it's not already the first waypoint
      if (distanceToFirst > 0.0001) {
        console.log("[toggleFollowMe] Prepending current location as waypoint");
        addWaypointAtStart({
          lat: userLocation.latitude,
          lng: userLocation.longitude,
          title: "Current location",
          source: "followme",
        });
      } else {
        console.log("[toggleFollowMe] Current location already at or near first waypoint");
      }
      
      // MAP_EFFECT will trigger and buildRoute will handle the routing
      // with followUser=true logic (current location → waypoints → destination)
      
    } else {
      console.log("[toggleFollowMe] Conditions not met. waypoints:", waypoints.length, "routeDestination:", !!routeDestination);
    }

    // Recenter + zoom + tilt
    skipNextFollowTickRef.current = true; // prevent immediate follow tick overriding
    skipNextRegionChangeRef.current = true; // prevent the recenter animation from disabling follow
    skipRegionChangeUntilRef.current = Date.now() + 2000;
    await recenterOnUser({ zoom: FOLLOW_ZOOM, pitch: 35 });

    // Start 15-minute inactivity timer
    // (routeSteps will be populated by buildRoute triggered via MAP_EFFECT)
    resetFollowMeInactivityTimeout();
  }

  /* ------------------------------------------------------------ */
  /* ROUTE TO HOME                                                */
  /* ------------------------------------------------------------ */
  async function routeToHome() {
    const homeAddress = auth?.profile?.homeAddress;
    
    if (!homeAddress || !homeAddress.trim()) {
      console.log("[ROUTE_TO_HOME] No home address set");
      await debugLog("ROUTE_TO_HOME", "No home address set");
      setPostbox({
        type: "warning",
        title: "No Home Address",
        message: "Please add your home address in the Profile screen to use this feature."
      });
      return;
    }

    if (!userLocation) {
      console.log("[ROUTE_TO_HOME] No user location");
      await debugLog("ROUTE_TO_HOME", "No user location available");
      setPostbox({
        type: "error",
        title: "No Location",
        message: "Unable to determine your current location."
      });
      return;
    }

    try {
      console.log("[ROUTE_TO_HOME] Geocoding address...");
      await debugLog("ROUTE_TO_HOME", "Geocoding address: " + homeAddress);
      
      // Geocode the home address
      const homeCoords = await geocodeAddress(homeAddress);
      
      if (!homeCoords) {
        console.log("[ROUTE_TO_HOME] Geocoding failed");
        await debugLog("ROUTE_TO_HOME", "Geocoding failed for address", { address: homeAddress });
        setPostbox({
          type: "error",
          title: "Invalid Address",
          message: "Unable to find your home address. Please check it in your Profile settings."
        });
        return;
      }

      // Clear existing waypoints and route
      clearWaypoints();
      setRouteCoords([]);
      routeFittedRef.current = false;
      setRouteClearedByUser(false); // Ensure route building is not blocked

      // Set home as destination
      await debugLog("ROUTE_TO_HOME", "Route to home initiated", { lat: homeCoords.lat, lng: homeCoords.lng });
      
      setRouteDestination({
        latitude: homeCoords.lat,
        longitude: homeCoords.lng,
        name: "Home",
      });
      setIsHomeDestination(true);
      
      // Build route BEFORE enabling Follow Me (since Follow Me skips route building)
      const requestId = ++routeRequestId.current;
      console.log("[ROUTE_TO_HOME] Building route before enabling Follow Me, requestId:", requestId);
      
      await mapRoute({
        origin: userLocation,
        waypoints: [],
        destination: {
          latitude: homeCoords.lat,
          longitude: homeCoords.lng,
          name: "Home",
        },
        travelMode: userTravelMode,
        routeType: userRouteType,
        requestId: requestId,
        skipFitToView: false, // Allow initial fit
      }).catch(error => {
        console.warn('[ROUTE_TO_HOME] mapRoute error:', error);
      });
      
      // Now enable Follow Me mode to guide to home
      skipNextFollowTickRef.current = true;
      skipNextRegionChangeRef.current = true;
      await recenterOnUser({ zoom: FOLLOW_ZOOM });
      setFollowUser(true);
      
      await debugLog("ROUTE_TO_HOME", "Follow Me enabled - tracking route home");
    } catch (error) {
      console.error("Error routing to home:", error);
      await debugLog("ROUTE_TO_HOME", "Error: " + error.message, { error });
      setPostbox({
        type: "error",
        title: "Error",
        message: "Failed to create route to home."
      });
    }
  }

  useEffect(() => {
    // Exit early if not in navigation mode (no Follow Me and no active ride)
    if (!isNavigationMode) return;
    if (!userLocation) return;

    if (skipNextFollowTickRef.current) {
      skipNextFollowTickRef.current = false;
      return;
    }

    // Reset inactivity timeout on each location update while in navigation mode
    // This keeps Follow Me on as long as the user is moving
    if (followUser) {
      resetFollowMeInactivityTimeout();
    }

    // Update camera during navigation (Follow Me or active ride)
    // If we have heading, use it for orientation; otherwise just center on location
    if (userLocation.heading !== undefined && userLocation.heading !== -1) {
      recenterOnUser({ heading: userLocation.heading, pitch: 35, zoom: FOLLOW_ZOOM });
    } else {
      // Fallback: center on location without heading (for active rides or when heading unavailable)
      recenterOnUser({ zoom: FOLLOW_ZOOM, pitch: 0 });
    }
  }, [userLocation, isNavigationMode]);

  // Compute distance to next junction (current step end). Advance step when close.
  useEffect(() => {
    if (!isNavigationMode) return;
    if (!userLocation) return;
    if (!routeSteps || routeSteps.length === 0) return;
    const idx = Math.min(currentStepIndex, routeSteps.length - 1);
    const step = routeSteps[idx];
    if (!step?.end?.latitude || !step?.end?.longitude) return;

    const d = distanceBetweenMeters(userLocation, step.end);
    setNextJunctionDistance(d);
    // Advance to next step only after current step is passed
    if (d !== null && d <= 0 && idx < routeSteps.length - 1) {
      setCurrentStepIndex(idx + 1);
    }
  }, [userLocation, isNavigationMode, routeSteps, currentStepIndex]);

  // Compute traveled and remaining polyline portions for Follow Me mode
  const { traveledPolyline, remainingPolyline } = useMemo(() => {
    if (!followUser || !routeCoords || routeCoords.length === 0 || !userLocation) {
      return { traveledPolyline: [], remainingPolyline: routeCoords };
    }

    // Find the closest coordinate to current user location
    let closestIdx = 0;
    let minDistance = Infinity;
    for (let i = 0; i < routeCoords.length; i++) {
      const dist = distanceBetweenMeters(userLocation, routeCoords[i]);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    // Only include points the user has actually passed (within 50m)
    const completedIdx = minDistance < 50 ? closestIdx : Math.max(0, closestIdx - 1);

    // Split polyline at the current user location
    return {
      traveledPolyline: routeCoords.slice(0, completedIdx + 1),
      remainingPolyline: routeCoords.slice(completedIdx),
    };
  }, [followUser, routeCoords, userLocation]);

  // Store the traveled polyline when Follow Me is active
  useEffect(() => {
    if (followUser && traveledPolyline.length > 0) {
      previousFollowUserRef.current = { isTraveling: true, polyline: traveledPolyline };
    }
  }, [followUser, traveledPolyline]);

  // Calculate remaining distance and time during Follow Me
  const { remainingDistanceMeters, remainingDurationSeconds } = useMemo(() => {
    if (!followUser || !remainingPolyline || remainingPolyline.length === 0 || !routeDistanceMeters || !routeMeta?.durationSeconds) {
      return { remainingDistanceMeters: routeDistanceMeters, remainingDurationSeconds: routeMeta?.durationSeconds };
    }

    // Calculate remaining polyline distance
    let remainingDist = 0;
    for (let i = 0; i < remainingPolyline.length - 1; i++) {
      remainingDist += distanceBetweenMeters(remainingPolyline[i], remainingPolyline[i + 1]);
    }

    // Calculate traveled distance
    const traveledDist = routeDistanceMeters - remainingDist;
    
    // Scale remaining time proportionally based on distance ratio
    const timeRatio = routeDistanceMeters > 0 ? remainingDist / routeDistanceMeters : 0;
    const remainingTime = Math.round(routeMeta.durationSeconds * timeRatio);

    return {
      remainingDistanceMeters: remainingDist,
      remainingDurationSeconds: remainingTime,
    };
  }, [followUser, remainingPolyline, routeDistanceMeters, routeMeta]);

  // Detect when Follow Me is turned off with a tracked ride
  useEffect(() => {
    // Only show save ride if:
    // 1. Follow Me was previously on but is now off
    // 2. There's a traveled polyline (accentDark line)
    // 3. The traveled polyline has meaningful distance (more than just starting point)
    
    // Check if we just turned OFF Follow Me
    if (previousFollowUserRef.current?.isTraveling === true && !followUser) {
      const savedPolyline = previousFollowUserRef.current.polyline;
      if (savedPolyline && savedPolyline.length > 1) {
        // Save the traveled polyline and show the modal
        setPendingRidePolyline(savedPolyline);
        setShowSaveRideModal(true);
        setSaveRideName("");
      }
    }
    
    // Update the ref for next time
    if (!followUser) {
      previousFollowUserRef.current = { isTraveling: false, polyline: [] };
    }
  }, [followUser]);

  // Keep screen awake during Follow Me or active ride
  useEffect(() => {
    if (followUser || activeRide) {
      KeepAwake.activateKeepAwake();
      return () => {
        // Keep awake will be deactivated when both Follow Me and active ride end
      };
    } else {
      KeepAwake.deactivateKeepAwake();
    }
  }, [followUser, activeRide]);

  /**
   * Route to the currently selected place and start Follow Me navigation
   * Used by the Follow Me tab button when a place is selected
   */
  async function routeToSelectedPlace() {
    if (!selectedPlace) return;
    
    // Route to the selected place
    await handleRoute(selectedPlace);
    
    // Close the place card
    setSelectedPlaceId(null);
    clearTempIfSafe();
    
    // Start Follow Me navigation after a brief delay to ensure route is set up
    setTimeout(() => {
      if (!followUser && userLocation) {
        console.log('[routeToSelectedPlace] Starting Follow Me');
        toggleFollowMe();
      }
    }, 300);
  }

  useEffect(() => {
    setMapActions({
      recenter: handleRecentre,
      toggleFollow: toggleFollowMe,
      isFollowing: () => followUser,
      showRefreshMenu: () => setShowRefreshRouteMenu(true),
      canRefreshRoute: () => userLocation && (waypoints.length > 0 || routeDestination),
      refreshRoute: handleRefreshRouteToNextWaypoint,
      routeToHome: routeToHome,
      routeToSelectedPlace: routeToSelectedPlace,
      endRide: endRide,
      selectedPlaceId: selectedPlaceId,
    });

    return () => {
      setMapActions(null);
    };
  }, [followUser, userLocation, waypoints, routeDestination, auth?.profile?.homeAddress, endRide, selectedPlace, selectedPlaceId]);

  useEffect(() => {
    let subscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("[MAP] Location permission denied");
        return;
      }

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
          try {
            const now = Date.now();
            let coordsToUse = location.coords;
            
            // Filter out inaccurate readings
            if (location.coords.accuracy && location.coords.accuracy > MAX_LOCATION_ACCURACY) {
              
              // Dead reckoning: estimate position using heading when GPS is poor
              if (lastGoodGPSRef.current && lastGPSTimeRef.current && location.coords.heading !== undefined && location.coords.heading !== -1) {
                const timeDiffSec = (now - lastGPSTimeRef.current) / 1000;
                const estimatedDistance = estimatedSpeedRef.current * timeDiffSec; // meters
                
                if (estimatedDistance > 0 && estimatedDistance < 200) { // Max 200m extrapolation
                  const heading = location.coords.heading * (Math.PI / 180); // Convert to radians
                  const lat = lastGoodGPSRef.current.latitude + (estimatedDistance / 111111) * Math.cos(heading);
                  const lng = lastGoodGPSRef.current.longitude + (estimatedDistance / 111111 / Math.cos(lastGoodGPSRef.current.latitude * Math.PI / 180)) * Math.sin(heading);
                  
                  coordsToUse = { ...lastGoodGPSRef.current, latitude: lat, longitude: lng };
                }
              }
              
              if (coordsToUse === location.coords) return; // No valid estimate, skip update
            }
            
            // Filter out movements < 3m (reduces jitter)
            if (userLocation) {
              const dist = distanceBetween(userLocation, coordsToUse);
              if (dist < MIN_LOCATION_MOVE_DISTANCE) {
                return;
              }
              
              // Update estimated speed (moving average)
              const timeDiffSec = (now - (lastGPSTimeRef.current || now)) / 1000;
              if (timeDiffSec > 0) {
                const speed = dist / timeDiffSec;
                estimatedSpeedRef.current = estimatedSpeedRef.current * 0.7 + speed * 0.3; // Exponential moving average
              }
            }
            
            // Track good GPS readings for dead reckoning
            if (location.coords.accuracy && location.coords.accuracy <= MAX_LOCATION_ACCURACY) {
              lastGoodGPSRef.current = location.coords;
              lastGPSTimeRef.current = now;
            }
            
            // Snap to polyline if on active route
            let coords = coordsToUse;
            if (isNavigationMode && routeCoords && routeCoords.length > 0) {
              const snappedPoint = projectPointToPolyline(coords, routeCoords);
              if (snappedPoint) {
                coords = { ...coords, ...snappedPoint };
              }
            }
            
            setUserLocation(coords);
          } catch (err) {
            console.error("[MAP] Error in location callback:", err);
            debugLog("GPS_ERROR", "Location callback error: " + err.message, { error: err.message });
          }
        },
        (error) => {
          console.error("[MAP] Location watch error:", error);
          
          // Handle specific location permission/service errors
          if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission')) {
            ToastAndroid.show('Location permission required to use map', ToastAndroid.SHORT);
          } else if (error?.code === 'POSITION_UNAVAILABLE' || error?.message?.includes('Cannot obtain')) {
            // This is a temporary GPS signal loss - don't overwhelm with ToastAndroid
            debugLog("GPS_UNAVAILABLE", "GPS signal temporarily unavailable");
          } else if (error?.code === 'TIMEOUT') {
            debugLog("GPS_TIMEOUT", "Location request timeout");
          } else {
            debugLog("GPS_ERROR", "Unexpected location error: " + error?.message || error);
          }
        }
      );
    })();

    return () => {
      subscription?.remove();
      clearFollowMeInactivityTimeout(); // Clean up inactivity timeout on unmount
    };
  }, []);


  /* ------------------------------------------------------------ */
  /* FETCH GOOGLE POIS ON REGION CHANGE                            */
  /* ------------------------------------------------------------ */

  const handleRegionChangeComplete = async (region) => {
    setMapRegion(region);

    // Debounce disables for 2s after programmatic camera moves
    if (skipRegionChangeUntilRef.current && Date.now() < skipRegionChangeUntilRef.current) {
      // Ignore region changes during debounce window
      return;
    }

    // IMPORTANT: Do NOT disable Follow Me during active Follow Me mode
    // All camera updates during Follow Me are programmatic (from location updates)
    // Only disable if user manually pans AFTER they were in Follow Me
    if (followUser) {
      // Skip pan detection entirely while Follow Me is active - 
      // map will update continuously as user location changes
      skipNextRegionChangeRef.current = false;
      return;
    }

    // For non-Follow Me mode: Disable if user panned the map
    // isAnimatingRef detects our own recenterOnUser() calls
    // skipNextRegionChangeRef catches route-to-home and other animations
    if (!isAnimatingRef.current && !skipNextRegionChangeRef.current) {
      lastUserPanTimeRef.current = Date.now();
    }
    skipNextRegionChangeRef.current = false;
    
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

    // Check if it's a ride or a route
    const checkAndLoadData = async () => {
      try {
        // First try to load as a ride
        const rideRef = doc(db, "rides", pendingSavedRouteId);
        const rideSnap = await getDoc(rideRef);
        
        if (rideSnap.exists()) {
          // It's a ride
          loadSavedRide(rideSnap.data(), pendingSavedRouteId);
          return;
        }
      } catch (error) {
        // If ride check fails (permissions, not found, etc.), just try as route
        console.log('[MAP] Ride check failed, trying as route:', error.message);
      }
      
      // Try as a route (either ride doesn't exist or failed to check)
      loadSavedRouteById(pendingSavedRouteId);
    };

    checkAndLoadData();
    setPendingSavedRouteId(null);
    
    // Enable Follow Me if requested (e.g., when starting an active ride)
    if (enableFollowMeAfterLoad) {
      setEnableFollowMeAfterLoad(false);
      // Use a delay to ensure route is fully loaded, fitted, and map is ready
      setTimeout(() => {
        if (!followUser && userLocation) {
          toggleFollowMe();
        }
      }, 1200); // Increased delay to let route fit complete
    }
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

      // Category from search result
      category: googlePlace.category,

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
    setIsHomeDestination(false);
    clearWaypoints();
    setRouteCoords([]);            // ✅ clear polyline HERE
    setRouteDistanceMeters(null);
    routeFittedRef.current = false;
    setCurrentLoadedRouteId(null);
  }

  function clearSearch() {
    setActiveQuery("");
    setGooglePois([]);
    setSearchInput("");
    lastSearchRef.current = "";

  }

  /* Used for Follow Me mode */

  async function doTextSearch({ query, latitude, longitude, radius = 50000 }) {
    if (!capabilities?.canSearchGoogle) {
      console.log("[GOOGLE] doTextSearch blocked by capability");
      return [];
    }

    const apiKey = Constants.expoConfig?.extra?.googlePlacesApiKey;
    if (!apiKey) {
      console.log("[GOOGLE] Missing googlePlacesApiKey in Constants.expoConfig.extra");
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

    try {
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

      const places = json?.places || [];
      return places
        .map((p) => mapGooglePlace(p, capabilities))
        .filter(p => p && p.latitude && p.longitude);
    } catch (error) {
      console.log("[GOOGLE] text search fetch error:", error.message);
      throw error; // Propagate to caller for user-facing error message
    }
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


      let results = [];
      try {
        results = await doTextSearch({
          query: activeQuery,
          latitude,
          longitude,
          radius,
          capabilities,
        });

        if (cancelled) return;

        setGooglePois(results);
      } catch (error) {
        if (cancelled) return;
        console.log("[SEARCH] Google search failed:", error.message);
        setGooglePois([]);
        // Don't return - continue to search local CR places
      }

      // --- Center map on exact match if found ---
      let exactMatch = null;
      // Check CR places for exact match
      exactMatch = crPlaces.find(
        (p) => p.source === "cr" && isExactMatch(p, activeQuery)
      );
      // If not found, check Google results for exact match
      if (!exactMatch && results.length) {
        exactMatch = results.find((p) => isExactMatch(p, activeQuery));
      }

      if (exactMatch && mapRef.current) {
        setSelectedPlaceId(exactMatch.id);
        mapRef.current.animateCamera(
          {
            center: {
              latitude: exactMatch.latitude,
              longitude: exactMatch.longitude,
            },
          },
          { duration: 600 }
        );
        return; // Centered on exact match, skip fitToCoordinates
      }

      // Fallback: fit to all results as before
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
    
    if (skipNextRebuildRef.current) {
      skipNextRebuildRef.current = false;
      return;
    }
    if (routeClearedByUser) {
      return;
    }
    if (isLoadingSavedRouteRef.current) {
      return;
    }
    // Don't auto-rebuild saved routes - they should only update on Follow Me or manual edits
    if (currentLoadedRouteId && !followUser) {
      return;
    }
    if (followUser) {
      return;
    }
    if (!userLocation) {
      return;
    }

    const hasInputs =
      routeDestination !== null || waypoints.length > 0;

    if (!hasInputs) {
      if (routeCoords.length > 0) {
        setRouteCoords([]);
      }
      return;
    }

    // If route type changed, always rebuild (ignore distance threshold)
    const routeTypeChanged = userRouteType !== lastRouteTypeRef.current;
    
    // If waypoints changed, always rebuild (ignore distance threshold)
    const waypointsChanged = waypoints.length !== lastWaypoints.current.length ||
      waypoints.some((wp, idx) => 
        !lastWaypoints.current[idx] || 
        wp.lat !== lastWaypoints.current[idx].lat || 
        wp.lng !== lastWaypoints.current[idx].lng
      );
    
    if (waypoints.length === lastWaypoints.current.length) {
      waypoints.forEach((wp, idx) => {
        const lastWp = lastWaypoints.current[idx];
        if (!lastWp) {
          console.log(`    [${idx}] No previous waypoint`);
        } else if (wp.lat !== lastWp.lat || wp.lng !== lastWp.lng) {
          console.log(`    [${idx}] Coords differ: (${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}) vs (${lastWp.lat.toFixed(5)}, ${lastWp.lng.toFixed(5)})`);
        } else {
          console.log(`    [${idx}] Same coords`);
        }
      });
    }
    
    // Check if user has moved far enough to warrant a route rebuild
    // This prevents excessive API calls from GPS noise (small accuracy variations)
    // But we skip this check if the route type or waypoints have changed
    if (!routeTypeChanged && !waypointsChanged && lastRouteBuildLocationRef.current) {
      const distanceMoved = distanceBetween(lastRouteBuildLocationRef.current, userLocation);
      if (distanceMoved < MIN_ROUTE_REBUILD_DISTANCE_METERS) {
        return; // Skip rebuild if movement is less than threshold
      }
    }

    const requestId = ++routeRequestId.current;
    buildRoute({ requestId }).catch(error => {
      console.warn('[MAP_EFFECT] buildRoute error:', error);
      // Error already handled as toast in buildRoute, no need to display again
    });
  }, [routeDestination, waypoints, routeClearedByUser, userLocation, userRouteType, currentLoadedRouteId, followUser]);

  /* ------------------------------------------------------------ */
  /* TOP 20 SELECTOR                                               */
  /* ------------------------------------------------------------ */

  const paddedRegion = useMemo(() => expandRegion(mapRegion, 1.4), [mapRegion]);

  const crMarkers = useMemo(() => {
    if (!paddedRegion) return [];

    let list = crPlaces.filter((p) => inRegion(p, paddedRegion));

    // If sponsor filter is active, include ALL sponsored places even if outside region
    if (appliedFilters.sponsor) {
      const sponsoredPlaces = crPlaces.filter(p => sponsoredPlaceIds.has(p.id));
      // Add any sponsored places that weren't in the region-filtered list
      sponsoredPlaces.forEach(sp => {
        if (!list.find(p => p.id === sp.id)) {
          console.log("[SPONSOR_FILTER] Adding sponsored place (outside region):", sp.id, sp.title);
          list = [...list, sp];
        }
      });
    }

    if (
      appliedFilters.suitability.size ||
      appliedFilters.categories.size ||
      appliedFilters.amenities.size ||
      appliedFilters.sponsor
    ) {
      console.log("[SPONSOR_FILTER] Filter active - sponsored places in list:", Array.from(sponsoredPlaceIds));
      
      list = list.filter((p) => {
        // Check sponsor filter first
        if (appliedFilters.sponsor) {
          const isSponsored = sponsoredPlaceIds.has(p.id);
          console.log("[SPONSOR_FILTER] Place", p.id, p.title, "- sponsored:", isSponsored);
          // Only show place if it's in the sponsored list
          if (!isSponsored) {
            return false;
          }
        }
        // Then check other filters
        return applyFilters(p, appliedFilters);
      });
    }

    return list;
  }, [
    crPlaces,
    paddedRegion,
    appliedFilters,
    sponsoredPlaceIds,
  ]);

  const searchMarkers = useMemo(() => {
    if (!activeQuery) return [];

    // Add CR places that match the search query (these take priority, include all even out of region)
    const crSearchMatches = crPlaces.filter(
      (p) => matchesQuery(p, activeQuery)
    );
    
    // Include Google POIs that are in region, but exclude any that have a matching CR place
    // Both by googlePlaceId AND by proximity (within 40 meters)
    const googleResults = googlePois.filter((p) => {
      if (!paddedRegion || !inRegion(p, paddedRegion)) return false;
      
      // Exclude if there's a CR place with the same googlePlaceId
      if (p.id && crSearchMatches.some(cr => cr.googlePlaceId === p.id)) {
        return false;
      }
      
      // Exclude if there's a CR place within ~40 meters (same location)
      // This prevents showing duplicates when the CR place doesn't have googlePlaceId set
      const PROXIMITY_THRESHOLD = 40; // meters
      const hasProximitMatch = crSearchMatches.some(cr => {
        const dx = (cr.latitude - p.latitude) * 111320; // meters per degree latitude
        const dy = (cr.longitude - p.longitude) * (40075000 * Math.cos((cr.latitude * Math.PI) / 180)) / 360; // meters per degree longitude
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < PROXIMITY_THRESHOLD;
      });
      
      if (hasProximitMatch) {
        return false;
      }
      
      return true;
    });
    
    return [...googleResults, ...crSearchMatches];
  }, [googlePois, crPlaces, paddedRegion, activeQuery]);


  const selectedPlace = useMemo(() => {

    if (!selectedPlaceId) return null;

    // 1️⃣ Newly created place
    if (newlyCreatedPlace && newlyCreatedPlace.id === selectedPlaceId) {
      return newlyCreatedPlace;
    }

    // 2️⃣ Temp Google-promoted place
    if (tempCrPlace && tempCrPlace.id === selectedPlaceId) {
      return tempCrPlace;
    }

    // 3️⃣ CR place
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

    // 4️⃣ Google-only place
    return searchMarkers.find(p => p.id === selectedPlaceId) || null;
  }, [selectedPlaceId, crMarkers, searchMarkers, tempCrPlace, newlyCreatedPlace]);


  /* ------------------------------------------------------------ */
  /* ROUTING                                                      */
  /* ------------------------------------------------------------ */

  async function handleRoute(place) {
    routeRequestId.current += 1;
    const requestId = routeRequestId.current;

    isLoadingSavedRouteRef.current = false;  // Allow rebuild when user starts new route
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

  /**
   * Core routing function that takes explicit parameters
   * Does not depend on component state - all inputs are passed in
   * Returns true if route was successfully mapped and displayed
   */
  async function mapRoute({
    origin,
    waypoints: waypointsList,
    destination,
    travelMode,
    routeType,
    requestId,
    skipFitToView = false, // Don't auto-center when in Follow Me mode
    followMeMode = false,  // Is this a Follow Me route?
  } = {}) {
    console.log("[mapRoute] Starting with requestId:", requestId, "waypoints:", waypointsList?.length || 0, "followMe:", followMeMode);
    
    if (!origin) {
      console.log("[mapRoute] No origin provided");
      return false;
    }

    // Normalize origin
    const startCoord = normalizeCoord(origin);
    if (!startCoord) {
      console.error('[mapRoute] Failed to normalize origin:', origin);
      return false;
    }

    // For Follow Me: check if first waypoint ≈ current location
    // If not, prepend current location to the waypoints
    let finalWaypoints = waypointsList || [];
    if (followMeMode && finalWaypoints.length > 0 && userLocation) {
      const firstWaypoint = normalizeCoord(finalWaypoints[0]);
      const currentLoc = normalizeCoord(userLocation);
      
      // Check if first waypoint is approximately current location (within ~5 meters)
      const distance = Math.sqrt(
        Math.pow(firstWaypoint.latitude - currentLoc.latitude, 2) + 
        Math.pow(firstWaypoint.longitude - currentLoc.longitude, 2)
      ) * 111000; // rough km to meters conversion
      
      console.log("[mapRoute] Follow Me check: first waypoint distance from current location:", distance.toFixed(1), 'meters');
      
      if (distance > 5) {
        // First waypoint is NOT current location, prepend current location
        console.log("[mapRoute] First waypoint is different from current location, prepending current location");
        finalWaypoints = [currentLoc, ...finalWaypoints];
      }
    }

    // Determine final destination
    let finalDestination = null;
    
    if (destination) {
      finalDestination = normalizeCoord(destination);
      if (!finalDestination) {
        console.error('[mapRoute] Failed to normalize destination coordinates:', destination);
        return false;
      }
    } else if (finalWaypoints.length > 0) {
      finalDestination = normalizeCoord(finalWaypoints[finalWaypoints.length - 1]);
      if (!finalDestination) {
        console.error('[mapRoute] Failed to normalize last waypoint coordinates');
        return false;
      }
    }

    if (!finalDestination) {
      console.error('[mapRoute] No valid final destination');
      return false;
    }

    // Determine intermediates
    let intermediates = [];
    if (destination) {
      intermediates = finalWaypoints;
      // Only user-added waypoints go in intermediates; destination will be final
      intermediates = waypointsList;
    } else if (waypointsList.length > 0) {
      // No explicit destination, so all but the last waypoint are intermediates
      intermediates = waypointsList.slice(0, -1);
    }

    // Normalize intermediates
    const normalizedIntermediates = intermediates
      .map(wp => normalizeCoord(wp))
      .filter(wp => wp !== null);
    
    // Validate origin
    const startCoord = normalizeCoord(origin);
    if (!startCoord) {
      console.error('[mapRoute] Failed to normalize origin:', origin);
      return false;
    }

    console.log("[mapRoute] Building route with:");
    console.log("  - Origin:", startCoord.latitude.toFixed(5), startCoord.longitude.toFixed(5));
    console.log("  - Waypoints:", normalizedIntermediates.length, normalizedIntermediates.map(w => `${w.latitude.toFixed(5)}, ${w.longitude.toFixed(5)}`));
    console.log("  - Destination:", finalDestination.latitude.toFixed(5), finalDestination.longitude.toFixed(5));

    // Try cache first if offline or as optimization
    // BUT: Always skip cache for Follow Me (skipFitToView=true indicates Follow Me)
    // to ensure we get a fresh route with the new waypoints
    let result = null;
    
    try {
      // Skip cache if this is a Follow Me request - always fetch fresh
      if (!skipFitToView) {
        console.log('[mapRoute] Checking cache...');
        console.log('[mapRoute] Cache query - origin:', startCoord.latitude.toFixed(5), startCoord.longitude.toFixed(5));
        console.log('[mapRoute] Cache query - destination:', finalDestination.latitude.toFixed(5), finalDestination.longitude.toFixed(5));
        console.log('[mapRoute] Cache query - intermediates count:', normalizedIntermediates.length);
        if (normalizedIntermediates.length > 0) {
          console.log('[mapRoute] Cache query - intermediates:', normalizedIntermediates.map(w => `${w.latitude.toFixed(5)},${w.longitude.toFixed(5)}`));
        }
        console.log('[mapRoute] Cache query - routeType:', routeType);
        
        const cachedResult = await getCachedRoute(
          startCoord,
          finalDestination,
          normalizedIntermediates,
          routeType
        );

        if (cachedResult) {
          console.log('[mapRoute] Using cached route - polyline points:', cachedResult.polyline?.length || 0);
          result = cachedResult;
        } else if (!networkStatus.isOnline) {
          console.warn('[mapRoute] Offline and no cached route available');
          ToastAndroid.show(
            'Route not in cache. Unable to fetch new route without internet.',
            ToastAndroid.LONG
          );
          return false;
        }
      } else {
        console.log('[mapRoute] Skipping cache for Follow Me - fetching fresh route');
      }
    } catch (error) {
      console.warn('[mapRoute] Error checking cache:', error);
      // Continue to fetch fresh route if cache check fails
    }

    // Fetch fresh route if not cached and online
    if (!result) {
      console.log('[mapRoute] Fetching fresh route from TomTom...');
      try {
        result = await fetchTomTomRoute(
          startCoord,
          finalDestination,
          normalizedIntermediates,
          travelMode,
          routeType,
          routeTypeMap,
          customHilliness,
          customWindingness
        );
      } catch (error) {
        console.warn('[mapRoute] Error fetching route from TomTom:', error.message);
        ToastAndroid.show(
          `Unable to fetch route: ${error.message}`,
          ToastAndroid.LONG
        );
        return false;
      }

      // Cache the fresh result
      if (result?.polyline) {
        try {
          await cacheRoute(
            startCoord,
            finalDestination,
            normalizedIntermediates,
            routeType,
            result
          );
        } catch (error) {
          console.warn('[mapRoute] Error caching route:', error);
        }
      }
    }

    console.log("[mapRoute] Result received. Has polyline:", !!result?.polyline);
    if (!result) {
      console.log("[mapRoute] Result is null, returning");
      return false;
    }

    // Check if this result is still relevant (request ID hasn't changed)
    if (requestId && requestId !== routeRequestId.current) {
      console.log("[mapRoute] Request ID mismatch - expected:", routeRequestId.current, "got:", requestId, "- discarding stale result");
      return false;
    }

    if (!result?.polyline) {
      console.log("[mapRoute] No polyline in result");
      return false;
    }

    // Simplify polyline for rendering
    const decoded = result.polyline;
    const simplified = simplifyPolyline(decoded, 0.00005); // ~5m tolerance
    console.log("[mapRoute] Decoded", decoded.length, "points, simplified to", simplified.length, "points");
    
    // For Follow Me mode with saved routes, prepend current user location to ensure we have the full path
    let finalRouteCoords = simplified;
    if (skipFitToView && origin && userLocation && simplified.length > 0) {
      console.log('[mapRoute] Follow Me mode detected (skipFitToView=true)');
      const originCoord = normalizeCoord(origin);
      if (originCoord) {
        const firstCoordLat = simplified[0].latitude;
        const firstCoordLng = simplified[0].longitude;
        
        // If first coord is different from current user location, prepend it
        const distance = Math.sqrt(
          Math.pow(originCoord.latitude - firstCoordLat, 2) + 
          Math.pow(originCoord.longitude - firstCoordLng, 2)
        );
        
        console.log('[mapRoute] Distance from origin to first route coord:', distance.toFixed(6), 'degrees');
        if (distance > 0.00001) {
          finalRouteCoords = [originCoord, ...simplified];
          console.log('[mapRoute] Prepended current location to Follow Me route');
        }
      }
    }
    
    // Update state with route data
    setRouteCoords(finalRouteCoords);
    setRouteMeta({
      distanceMeters: result.distanceMeters ?? result.distance,
      durationSeconds: result.durationSeconds ?? result.duration,
    });
    setRouteSteps(result.steps ?? []);
    setCurrentStepIndex(0);
    
    if (typeof result?.distanceMeters === 'number' && result.distanceMeters > 0) {
      setRouteDistanceMeters(result.distanceMeters);
    } else if (typeof result?.distance === 'number' && result.distance > 0) {
      setRouteDistanceMeters(result.distance);
    } else {
      setRouteDistanceMeters(null);
    }

    // Auto-fit view if not in Follow Me and not already fitted
    if (!skipFitToView && !routeFittedRef.current && !followUser) {
      routeFittedRef.current = true;
      mapRef.current?.fitToCoordinates(finalRouteCoords, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
    
    setLastEncodedPolyline(result.polyline);
    await debugLog("ROUTE_BUILT", `Route built: ${simplified.length} points, ${(result.distanceMeters / 1000).toFixed(1)}km`, { points: simplified.length, distanceKm: (result.distanceMeters / 1000).toFixed(1) });
    
    return true;
  }

  async function buildRoute({ destinationOverride = null, requestId } = {}) {
    // Wrapper that calls mapRoute with current component state
    const finalRequestId = requestId || routeRequestId.current;
    console.log("[buildRoute] Starting - requestId:", finalRequestId, "destination:", routeDestination?.title, "waypoints:", waypoints.length);
    
    if (!routeDestination && !destinationOverride && waypoints.length === 0) {
      console.log("[buildRoute] No destination or waypoints, returning");
      return;
    }
    if (!userLocation) {
      console.log("[buildRoute] No user location, returning");
      return;
    }

    const destination = destinationOverride || routeDestination || null;

    // Simple routing logic: need either explicit destination or 2+ waypoints
    const canRoute = destination || waypoints.length > 1;
    
    console.log("[buildRoute] waypoints.length:", waypoints.length, "destination:", !!destination);
    
    if (!canRoute) {
      console.log("[buildRoute] ❌ RETURNING EARLY - Need destination or 2+ waypoints to route");
      return;
    }

    // Track what we're using for comparison
    if (userLocation) {
      lastRouteBuildLocationRef.current = normalizeCoord(userLocation);
      lastRouteTypeRef.current = userRouteType;
      lastWaypoints.current = waypoints;
    }

    // Determine origin: first waypoint or current location
    const origin = waypoints.length > 0 ? waypoints[0] : userLocation;
    
    // Build the routing list and destination
    let routeWaypoints = [];
    let finalDestination = destination;
    
    console.log("[buildRoute] 🚀 About to call mapRoute");
    
    if (waypoints.length > 0) {
      // We have waypoints: route from first waypoint through the rest
      routeWaypoints = waypoints.slice(1);
      finalDestination = destination || (waypoints.length > 1 ? waypoints[waypoints.length - 1] : null);
      console.log("[buildRoute] Routing from waypoints[0] through", routeWaypoints.length, 'more waypoints');
    }
    
    // For Follow Me: check if first waypoint ≈ current location
    // If not, we'll prepend current location in mapRoute
    const skipFitToView = followUser;
    
    await mapRoute({
      origin,
      waypoints: routeWaypoints,
      destination: finalDestination,
      travelMode: userTravelMode,
      routeType: userRouteType,
      requestId: finalRequestId,
      skipFitToView,
      followMeMode: followUser,
    });
    console.log("[buildRoute] ✅ mapRoute called successfully");
  }

  async function loadSavedRouteById(routeId) {
    const ref = doc(db, "routes", routeId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("[MAP] saved route not found", routeId);
      return;
    }

    const route = snap.data();

    loadSavedRoute(route, routeId);
    setCurrentLoadedRouteId(routeId);
  }

  async function loadSavedRoute(route, routeId) {
    clearRoute();
    clearWaypoints();
    isLoadingSavedRouteRef.current = true;

    console.log("[loadSavedRoute] Starting to load route:", route.title);
    console.log("[loadSavedRoute] Route has", route.waypoints?.length || 0, "waypoints, origin:", !!route.origin, "destination:", !!route.destination);

    // Waypoints (normalise + rebuild)
    let actualOrigin = route.origin;
    let originWasCorrected = false;
    
    if (Array.isArray(route.waypoints)) {
      const normalisedWaypoints = route.waypoints.map((wp, idx) => {
        const normalized = {
          latitude: wp.latitude ?? wp.lat,
          longitude: wp.longitude ?? wp.lng,
          title: wp.title ?? null,
          source: wp.source ?? "saved",
        };
        console.log(`  [${idx}] ${normalized.latitude}, ${normalized.longitude} (${normalized.title})`);
        return normalized;
      });

      // Filter out waypoints that are at the same location as the origin
      // This handles routes that were saved with duplicate start point
      let waypointsToAdd = normalisedWaypoints;
      if (actualOrigin) {
        const originLat = actualOrigin.lat ?? actualOrigin.latitude;
        const originLng = actualOrigin.lng ?? actualOrigin.longitude;
        
        waypointsToAdd = normalisedWaypoints.filter((wp, idx) => {
          const isDuplicate = Math.abs(wp.latitude - originLat) < 0.00001 && 
                             Math.abs(wp.longitude - originLng) < 0.00001;
          if (isDuplicate) {
            console.log(`  [${idx}] Skipping duplicate waypoint at origin location`);
          }
          return !isDuplicate;
        });
      }

      console.log("[loadSavedRoute] Adding", waypointsToAdd.length, "waypoints from saved route");
      waypointsToAdd.forEach((wp, idx) => {
        console.log("[loadSavedRoute] Adding waypoint", idx);
        addFromPlace(wp);
      });
    }
    
    // Add the origin as the first waypoint
    if (actualOrigin) {
      const originWaypoint = {
        lat: actualOrigin.lat ?? actualOrigin.latitude,
        lng: actualOrigin.lng ?? actualOrigin.longitude,
        title: "Route start",
        source: "saved",
      };
      
      console.log("[loadSavedRoute] Adding origin as first waypoint");
      // Add as first waypoint using the context function
      addWaypointAtStart(originWaypoint);
    }
    
    // If origin was corrected, update the route in Firestore
    if (originWasCorrected && routeId) {
      try {
        await updateDoc(doc(db, "routes", routeId), {
          origin: {
            lat: actualOrigin.lat || actualOrigin.latitude,
            lng: actualOrigin.lng || actualOrigin.longitude,
          }
        });
      } catch (error) {
        console.error("[loadSavedRoute] Error updating route in Firestore:", error);
      }
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
      // Handle both encoded strings and already-decoded arrays
      let decoded;
      
      if (Array.isArray(route.routePolyline)) {
        // Already decoded - just normalize the format
        decoded = route.routePolyline.map(point => ({
          latitude: point.latitude ?? point[0],
          longitude: point.longitude ?? point[1],
        }));
      } else if (typeof route.routePolyline === 'string') {
        // Encoded polyline - decode it
        decoded = decode(route.routePolyline).map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
      } else {
        console.warn('[loadSavedRoute] Invalid routePolyline format:', typeof route.routePolyline);
        decoded = [];
      }

      setRouteCoords(decoded);
      setLastEncodedPolyline(typeof route.routePolyline === 'string' ? route.routePolyline : null);

      // Set routed total distance from saved route (if present)
      if (typeof route.distanceMeters === 'number' && route.distanceMeters > 0) {
        setRouteDistanceMeters(route.distanceMeters);
      } else if (typeof route.distance === 'number' && route.distance > 0) {
        setRouteDistanceMeters(route.distance);
      } else {
        setRouteDistanceMeters(null);
      }

      // 🔑 use the pending-fit system you already built
      pendingFitRef.current = decoded;
      attemptRouteFit();
    }

    // Allow rebuild when route loading is complete (regardless of polyline source)
    isLoadingSavedRouteRef.current = false;
    setRoutingActive(true);
  }

  async function loadSavedRideById(rideId) {
    const ref = doc(db, "rides", rideId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("[MAP] saved ride not found", rideId);
      return;
    }

    const ride = snap.data();
    loadSavedRide(ride, rideId);
  }

  async function loadSavedRide(ride, rideId) {
    clearRoute();
    clearWaypoints();

    if (ride.ridePolyline && Array.isArray(ride.ridePolyline)) {
      const decoded = ride.ridePolyline;
      
      // Set the polyline so it's visible on map
      pendingFitRef.current = decoded;
      attemptRouteFit();

      // Set title to show this is a completed ride
      setRouteDestination({
        title: ride.name || "Completed Ride",
        latitude: decoded[decoded.length - 1]?.latitude || 0,
        longitude: decoded[decoded.length - 1]?.longitude || 0,
      });

      setRoutingActive(true);

      // Track that we're viewing a saved ride (for save-as-route flow)
      setViewedRideId(rideId);
      setPendingRidePolyline(decoded);

      // Show save modal for converting to route
      setShowSaveRideModal(true);
    }
  }

  function handleNavigate(placeOverride = null) {
    const destination = placeOverride || routeDestination;
    if (!userLocation) return;

    // Build navigation waypoints starting with waypoints if present
    const navWaypoints = waypoints && waypoints.length > 0 ? waypoints : [];

    // ─────────────────────────────
    // Case 1: Destination exists
    // ─────────────────────────────
    if (destination) {
      // No waypoints → simple navigation
      if (!waypoints.length) {
        openNavigationWithWaypoints({
          origin: userLocation,
          waypoints: [
            ...navWaypoints,
            {
              lat: destination.latitude,
              lng: destination.longitude,
              title: destination.title || "Destination",
            },
          ],
        });
        return;
      }

      // Waypoints → intermediates + destination
      openNavigationWithWaypoints({
        origin: userLocation,
        waypoints: [
          ...navWaypoints,
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
    // ─────────────────────────────
    if (waypoints.length) {
      openNavigationWithWaypoints({
        origin: userLocation,
        waypoints: [
          ...navWaypoints,
          ...waypoints.map(wp => ({
            lat: wp.lat,
            lng: wp.lng,
            title: wp.title,
          })),
        ],
      });
    }
  }

  function attemptRouteFit() {
    if (!mapRef.current) return;
    if (!mapReadyRef.current) return;
    if (!pendingFitRef.current) return;
    if (followUser) return; // Don't interrupt Follow Me mode

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

  // Category → outline color map for markers
  function getCategoryStrokeColor(category) {
    const categoryColorMap = {
      cafe: "#8B4513",           // brown
      restaurant: "#D4641D",     // orange-brown
      pub: "#8B0000",            // dark red
      bikes: "#DC143C",          // crimson
      fuel: "#006994",           // petrol blue
      parking: "#556B2F",        // dark olive
      scenic: "#228B22",         // forest green
      camping: "#228B22",        // forest green
      accommodation: "#663399",  // purple
      unknown: "#696969",        // dim gray
    };
    return categoryColorMap[category] || categoryColorMap.unknown;
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
    const isSponsor = sponsoredPlaceIds.has(poi.id); // Check if place has active sponsorship

    const isSearchHitCR = activeQuery && isCr && matchesQuery(poi, activeQuery);
    const isSearchHitGoogle = activeQuery && !isCr && matchesQuery(poi, activeQuery);
    const isExactCR = isSearchHitCR && isExactMatch(poi, activeQuery);
    const isExactGoogle = isSearchHitGoogle && isExactMatch(poi, activeQuery);

    let markerMode = "default";
    let zIndex = 1;
    if (isDestination) {
      markerMode = "destination";
      zIndex = 1000;
    } else if (isExactCR) {
      markerMode = "searchCRExact";
      zIndex = 900; // Highest search priority
    } else if (isSearchHitCR) {
      markerMode = "searchCRPartial";
      zIndex = 800; // Partial CR matches
    } else if (isExactGoogle) {
      markerMode = "searchGoogleExact";
      zIndex = 750; // Exact Google matches
    } else if (isSearchHitGoogle) {
      markerMode = "searchGooglePartial";
      zIndex = 700; // Partial Google matches
    } else if (isSponsor) {
      markerMode = "sponsor";
      zIndex = 600; // Higher priority than regular CR places
    } else if (isCr) {
      markerMode = "cr";
      zIndex = 500;
    } else if (isTemp) {
      markerMode = "temp";
      zIndex = 600;
    }

    const categoryStroke = getCategoryStrokeColor(category);

    const markerStyles = {
      destination: {
        fill: theme.colors.primary,
        circle: theme.colors.accentMid,
        stroke: theme.colors.danger,
      },
      sponsor: {
        fill: theme.colors.accentMid,
        circle: theme.colors.accentLight,
        stroke: "#A855F7", // vibrant purple for sponsors
      },
      searchCRExact: {
        fill: "#FFD700",         // bright gold for CR places
        circle: "#FFA500",
        stroke: theme.colors.danger, // dark red outline for exact match
      },
      searchCRPartial: {
        fill: theme.colors.accentMid,    // accent for partial CR matches
        circle: theme.colors.accentLight,
        stroke: theme.colors.accentDark, // dark accent outline for partials
      },
      searchGoogleExact: {
        fill: theme.colors.primaryMid,   // primary blue for exact Google matches
        circle: theme.colors.accentMid,  // accent circle (not sinister)
        stroke: theme.colors.danger,     // dark red outline for exact matches
      },
      searchGooglePartial: {
        fill: theme.colors.primaryMid,   // primary blue for partial Google matches
        circle: theme.colors.primaryLight,
        stroke: theme.colors.accentDark, // dark accent outline for partials
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

    const { fill, circle, stroke, strokeWidth } = markerStyles[markerMode];
    const pinSize = isSponsor ? 38 : 36; // Slightly bigger size for sponsors

    const handleMarkerPress = (e) => {
      console.log("[MARKER] Marker.onPress on:", poi.title || poi.name, "selectedPlaceId will be:", poi.id);
      markerPressedRef.current = true;
      // Reset the flag after a short delay so MapView.onPress can check it
      setTimeout(() => {
        markerPressedRef.current = false;
      }, 100);
      
      if (poi.source === "google") {
        if (!capabilities.canSearchGoogle) return;
        const temp = promoteGoogleToTempCr(poi);
        if (temp) {
          console.log("[MARKER] Google place, promoting to temp:", temp.id);
          setSelectedPlaceId(temp.id);
        }
        return;
      }

      console.log("[MARKER] Setting selectedPlaceId to:", poi.id);
      setSelectedPlaceId(poi.id);
    };

    const handleMarkerLongPress = () => {
      console.log("[MARKER] Long press on:", poi.title || poi.name);
      if (!capabilities.canCreateRoutes) return;
      
      setPendingMarker(poi);
      setShowMarkerMenu(true);
    };

    return (
      <Marker
        key={`${poi.source}-${poi.id}`}
        coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
        onPress={handleMarkerPress}
        anchor={{ x: 0.5, y: 1 }}
        zIndex={zIndex}
      >
        <Pressable
          delayLongPress={500}
          onLongPress={handleMarkerLongPress}
          onPress={() => {}} // Consume the press to avoid double-triggering
        >
          <SvgPin icon={icon} fill={fill} circle={circle} stroke={stroke} strokeWidth={strokeWidth} size={pinSize} />
        </Pressable>
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
          customMapStyle={colorScheme === 'dark' ? mapStyleDark : mapStyleLight}
          showsUserLocation={true}
          pitchEnabled
          showsMyLocationButton={false}
          minZoomLevel={Platform.OS === "ios" ? 1 : 0}
          maxZoomLevel={Platform.OS === "ios" ? 28 : 18}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={() => {
            // Don't clear selectedPlace if a marker was just pressed
            if (markerPressedRef.current) {
              console.log("[MAP] Marker press detected, not clearing selectedPlaceId");
              return;
            }
            
            if (showFilters) {
              setShowFilters(false);
              return;
            }
            if (!routeCoords.length) {
              setSelectedPlaceId(null);
              clearTempIfSafe();
            }
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
          {activeQuery ? searchMarkers.map(renderMarker) : crMarkers.map(renderMarker)}

          {routeDestination && (
            <Marker
              coordinate={{
                latitude: routeDestination.latitude,
                longitude: routeDestination.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={950}
            >
              <SvgPin
                icon={isHomeDestination ? "home" : "flag-checkered"}
                fill={theme.colors.primary}
                circle={theme.colors.accentMid}
                stroke={theme.colors.danger}
              />
            </Marker>
          )}

          {/* Waypoint markers - show all waypoints in the route */}
          {capabilities.canCreateRoutes && waypoints.length > 0 && (
            (() => {
              return waypoints.map((wp, index) => (
                  <Marker
                    key={`wp-${index}`}
                    coordinate={{ latitude: wp.lat, longitude: wp.lng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    zIndex={950}
                    tracksViewChanges={false}
                  >
                    <View style={styles.waypointPin}>
                      <Text style={styles.waypointIndex}>{index + 1}</Text>
                    </View>
                  </Marker>
                ));
            })()
          )}

            {/* Base route */}
              <Polyline
                key={`base-${routeVersion}`}
                coordinates={routeCoords}
                strokeWidth={isNavigationMode ? 10 : 6}
                strokeColor={theme.colors.primaryMuted}
                zIndex={900}
              />

            {/* Traveled route (during Follow Me) */}
              {followUser && traveledPolyline.length > 1 && (
                <Polyline
                  key={`traveled-${routeVersion}`}
                  coordinates={traveledPolyline}
                  strokeWidth={isNavigationMode && followUser ? 7 : 5}
                  strokeColor={theme.colors.accentDark}
                  zIndex={1001}
                />
              )}

            {/* Remaining route */}
              <Polyline
                key={`active-${routeVersion}`}
                coordinates={followUser && remainingPolyline.length > 0 ? remainingPolyline : routeCoords}
                strokeWidth={isNavigationMode && followUser ? 7 : (isNavigationMode ? 5 : 3)}
                strokeColor={theme.colors.primary}
                zIndex={1000}
              />
        </MapView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.primaryDark }}>
          <MaterialCommunityIcons name="map-marker-radius" size={48} color={theme.colors.primaryLight} />
          <Text style={{ color: theme.colors.text, marginTop: 12, fontSize: 16 }}>Getting location...</Text>
          <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primaryLight, opacity: 0.3 }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primaryLight, opacity: 0.6 }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primaryLight, opacity: 1 }} />
          </View>
        </View>
      )}

      {/* Mini map showing group members when riding */}
      {activeRide && riderLocations.length > 0 && (
        <View style={styles.miniMapContainer}>
          <MiniMap
            riderLocations={riderLocations}
            userLocation={userLocation}
            routeCoords={routeCoords}
            mapStyleDark={mapStyleDark}
            mapStyleLight={mapStyleLight}
            colorScheme={colorScheme}
          />
        </View>
      )}
      
      {showFilters && (
        <View style={styles.filterPanel}>
          <ScrollView
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
            showsVerticalScrollIndicator={false}
          >
           
            {/* SUITABILITY */}
            <Text style={styles.filterSection}>Meet-ups / Suitability</Text>
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
                      name={a.icon || "check"}
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

              {/* SPONSORS (ADMIN ONLY) */}
              {capabilities?.isAdmin && (
                <TouchableOpacity
                  key="sponsor"
                  style={[
                    styles.iconButton,
                    draftFilters.sponsor && styles.iconButtonActive,
                  ]}
                  onPress={() =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      sponsor: !prev.sponsor,
                    }))
                  }
                >
                  <MaterialCommunityIcons
                    name="star"
                    size={32}
                    color={draftFilters.sponsor ? theme.colors.accent : theme.colors.primaryLight}
                  />
                  <Text
                    style={[
                      styles.iconLabel,
                      draftFilters.sponsor && styles.iconLabelActive,
                    ]}
                  >
                    Sponsors
                  </Text>
                </TouchableOpacity>
              )}
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

      {/* Junction panel (top-left) during navigation - helmet visible */}
      {isNavigationMode && hasRoute && routeSteps && routeSteps.length > 0 && (
        (() => {
          // Debug: log all steps and current step index
          console.log('[JunctionPanel] routeSteps:', routeSteps);
          console.log('[JunctionPanel] currentStepIndex:', currentStepIndex, 'nextStepIndex:', Math.min(currentStepIndex + 2, routeSteps.length - 1));
          // Show the NEXT step's maneuver (what's coming), not the current step
          const nextStepIndex = Math.min(currentStepIndex + 1, routeSteps.length - 1);
          const step = routeSteps[nextStepIndex];
          let m = step?.maneuver || "STRAIGHT";
          // Normalize maneuver type for lookup
          if (typeof m === "string") m = m.trim().toUpperCase();
          let meta = MANEUVER_ICON_MAP[m];
          if (!meta) {
            // Try fallback for common roundabout variants
            if (m.includes("ROUNDABOUT")) {
              meta = MANEUVER_ICON_MAP.ROUNDABOUT_ENTER;
            } else {
              meta = MANEUVER_ICON_MAP.STRAIGHT;
            }
          }
          const dist = nextJunctionDistance;
          const distText = dist != null ? formatDistanceImperial(dist) : "";
          // Prefer TomTom's instruction for roundabouts, else use label
          let label = meta.label;
          let roundaboutExit = null;
          if (m.includes("ROUNDABOUT")) {
            // Trace roundabout exit extraction
            console.log('[JunctionPanel] step:', step);
            console.log('[JunctionPanel] FULL STEP OBJECT:', JSON.stringify(step));
            // Check for roundaboutExitNumber (primary field from TomTom)
            if (typeof step.roundaboutExitNumber === "number" && step.roundaboutExitNumber > 0) {
              roundaboutExit = step.roundaboutExitNumber;
              console.log('[JunctionPanel] Found step.roundaboutExitNumber:', roundaboutExit, 'step:', JSON.stringify(step));
            }
            // Also check for exitNumber as fallback
            if (!roundaboutExit && typeof step.exitNumber === "number" && step.exitNumber > 0) {
              roundaboutExit = step.exitNumber;
              console.log('[JunctionPanel] Found step.exitNumber:', roundaboutExit, 'step:', JSON.stringify(step));
            }
            // If not found, try parsing from instruction text
            if (!roundaboutExit && step?.instruction) {
              const match = step.instruction.match(/exit\s*(\d+)/i);
              if (match) {
                roundaboutExit = parseInt(match[1], 10);
                console.log('[JunctionPanel] Parsed exit from instruction:', roundaboutExit, 'step:', JSON.stringify(step));
              }
            }
            if (roundaboutExit) {
              label = `Take exit no. ${roundaboutExit}`;
              console.log('[JunctionPanel] Set label:', label, 'exitNumber:', roundaboutExit, 'step:', JSON.stringify(step));
            } else if (step?.instruction && step.instruction !== "Continue") {
              label = step.instruction;
              console.log('[JunctionPanel] Fallback to step.instruction:', label, 'exitNumber:', roundaboutExit, 'step:', JSON.stringify(step));
            } else if (meta.label) {
              label = meta.label;
              console.log('[JunctionPanel] Fallback to meta.label:', label, 'exitNumber:', roundaboutExit, 'step:', JSON.stringify(step));
            } else {
              label = "Proceed through roundabout";
              console.log('[JunctionPanel] Fallback to default label:', label, 'exitNumber:', roundaboutExit, 'step:', JSON.stringify(step));
            }
          }
          return (
            <View style={styles.junctionPanel}>
              {/* Large direction icon */}
              <MaterialCommunityIcons name={meta.icon} size={64} color="rgba(245, 245, 240, 0.95)" style={styles.junctionIcon} />
              {/* Distance and label section */}
              <View style={styles.junctionContent}>
                {distText ? (
                  <Text style={styles.junctionDistance}>{distText}</Text>
                ) : null}
                <Text style={styles.junctionLabel}>{label}</Text>
                {remainingDistanceMeters && remainingDurationSeconds && (
                  <Text style={styles.junctionRemaining}>
                    {formatDistanceImperial(remainingDistanceMeters)} • {(() => {
                      const totalMins = Math.round(remainingDurationSeconds / 60);
                      const hours = Math.floor(totalMins / 60);
                      const mins = totalMins % 60;
                      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                    })()} remaining
                  </Text>
                )}
              </View>
            </View>
          );
        })()
      )}
      {postbox && (
        <View style={[
          styles.postbox,
          postbox.type === 'error' && styles.postboxError,
          postbox.type === 'warning' && styles.postboxWarning,
          postbox.type === 'success' && styles.postboxSuccess,
          postbox.type === 'info' && styles.postboxInfo,
        ]}>
          {postbox.title && <Text style={styles.postboxTitle}>{postbox.title}</Text>}
          <Text style={styles.postboxText}>{postbox.message}</Text>
        </View>
      )}

      {!followUser && !activeRide && (
        <WaypointsList
          waypoints={displayWaypoints}
          onClearAll={clearNavigationIntent}
          routeOrigin={waypoints.length > 0 ? waypoints[0] : userLocation}
          // Always pass routedTotalMeters from state, fallback to routeMeta if needed
          routedTotalMeters={
            typeof routeDistanceMeters === 'number' && routeDistanceMeters > 0
              ? routeDistanceMeters
              : (typeof routeMeta?.distanceMeters === 'number' && routeMeta.distanceMeters > 0
                  ? routeMeta.distanceMeters
                  : undefined)
          }
          // Pass route duration in seconds
          routedTotalDurationSeconds={
            typeof routeMeta?.durationSeconds === 'number' && routeMeta.durationSeconds > 0
              ? routeMeta.durationSeconds
              : undefined
          }
        />
      )}

      {hasRouteIntent && !followUser && !activeRide && canSaveRoute && (
        <TouchableOpacity
          style={[styles.saveRouteButton, { bottom: saveButtonBottom }]}
          onPress={() => setShowSaveRouteModal(true)}
        >
          <MaterialCommunityIcons
            name="map-marker-path"
            size={22}
            color={theme.colors.primaryDark}
          />
          <Text style={styles.saveRouteButtonText}>Save</Text>
        </TouchableOpacity>
      )}

      {!followUser && !activeRide && (
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={(query) => {
            setActiveQuery(query);
            setSearchOrigin(mapRegion);
          }}
          onClear={clearSearch}
          onFilterPress={() => setShowFilters(prev => !prev)}
          filtersActive={filtersActive}
          onRouteTypePress={() => setShowRouteTypeSelector(true)}
          routeTypeActive={isRouteTypeNonDefault}
        />
      )}

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
          onPlaceCreated={(newPlace) => {
            // Show feedback
            const placeName = newPlace.title || newPlace.name || "Place";
            setPostbox({
              title: "Place added",
              message: `${placeName} has been added to Coffee Rider`,
            });

            // Store the newly created place temporarily
            setNewlyCreatedPlace(newPlace);
            
            // Switch selection to the newly created place
            setSelectedPlaceId(newPlace.id);
          }}
          onAddWaypoint={(placeArg) => {
            addFromPlace(placeArg);
          }}
        />
      )}

      {/* Marker long press menu - just routing options, no "Add new place" */}
      <Modal visible={showMarkerMenu} transparent animationType="fade">
        <View style={styles.pointMenuOverlay}>
          <View style={styles.pointMenu}>
            <Pressable
              onPress={() => {
                closeMarkerMenu();
                if (pendingMarker) addFromPlace(pendingMarker);
              }}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="map-marker-plus"
                size={26}
                color={theme.colors.accent}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.pointMenuText}>Add waypoint</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                closeMarkerMenu();
                if (pendingMarker) {
                  addFromMapPress({
                    latitude: pendingMarker.latitude,
                    longitude: pendingMarker.longitude,
                    isStartPoint: true,
                  });
                }
              }}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="flag"
                size={26}
                color={theme.colors.accent}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.pointMenuText}>Add start point</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                closeMarkerMenu();
                if (pendingMarker) {
                  handleRoute(pendingMarker);
                }
              }}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="flag-checkered"
                size={26}
                color={theme.colors.accent}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.pointMenuText}>Add as destination</Text>
            </Pressable>

            <Pressable
              onPress={closeMarkerMenu}
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

      <Modal visible={showAddPointMenu} transparent animationType="fade">
        <View style={styles.pointMenuOverlay}>
          <View style={styles.pointMenu}>
            {/* Show "Add new place here" if no route and user can create places */}
            {!routeCoords.length && capabilities.canCreateCrPlaces && (
              <Pressable
                onPress={() => {
                  closeAddPointMenu();
                  // Create a new place object with pending location
                  const newPlace = {
                    id: `new-${Date.now()}`,
                    latitude: pendingMapPoint?.latitude,
                    longitude: pendingMapPoint?.longitude,
                    title: pendingMapPoint?.geocodeResult || "New Place",
                    _temp: true,
                    source: "cr",
                  };
                  setTempCrPlace(newPlace);
                  setSelectedPlaceId(newPlace.id);
                }}
                style={({ pressed }) => [
                  styles.pointMenuItem,
                  pressed && { backgroundColor: theme.colors.primaryDark },
                ]}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={26}
                  color={theme.colors.accent}
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.pointMenuText}>Add new place here</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleAddWaypoint}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="map-marker-plus"
                size={26}
                color={theme.colors.accent}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.pointMenuText}>Add waypoint</Text>
            </Pressable>

            <Pressable
              onPress={handleSetStart}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="flag-triangle"
                size={26}
                color={theme.colors.accent}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.pointMenuText}>Add as start point</Text>
            </Pressable>

            <Pressable
              onPress={handleSetDestination}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="flag-checkered"
                size={26}
                color={theme.colors.accent}
                style={{ marginRight: 12 }}
              />
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

      <Modal visible={showRefreshRouteMenu} transparent animationType="slide">
        <Pressable style={styles.refreshMenuOverlay} onPress={closeRefreshRouteMenu}>
          <View style={styles.refreshMenu}>
            <Pressable
              onPress={handleRefreshRouteToNextWaypoint}
              style={({ pressed }) => [
                styles.refreshMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={28}
                color={theme.colors.accent}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.refreshMenuText}>Refresh route from current location</Text>
            </Pressable>

            <Pressable
              onPress={closeRefreshRouteMenu}
              style={({ pressed }) => [
                styles.refreshMenuItem,
                styles.refreshMenuCancel,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <Text style={styles.refreshMenuCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Save Route Modal */}
      <Modal
        visible={showSaveRouteModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowSaveRouteModal(false);
          setSaveRouteName("");
        }}
      >
        <View style={styles.saveRouteModalOverlay}>
          <View style={styles.saveRouteModalContent}>
            <Text style={styles.saveRouteModalTitle}>Save Route</Text>
            
            <TextInput
              style={styles.saveRouteInput}
              placeholder={currentLoadedRouteId ? "Leave blank to update current route" : "Route name (optional)"}
              placeholderTextColor={theme.colors.primaryLight}
              value={saveRouteName}
              onChangeText={setSaveRouteName}
              returnKeyType="done"
            />

            <View style={styles.saveRouteModalButtons}>
              <TouchableOpacity
                style={[styles.saveRouteModalButton, styles.saveRouteModalButtonSave]}
                onPress={() => handleSaveRoute(saveRouteName || undefined)}
              >
                <Text style={styles.saveRouteModalButtonText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveRouteModalButton, styles.saveRouteModalButtonCancel]}
                onPress={() => {
                  setShowSaveRouteModal(false);
                  setSaveRouteName("");
                }}
              >
                <Text style={styles.saveRouteModalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Ride Modal */}
      <Modal
        visible={showSaveRideModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowSaveRideModal(false);
          setSaveRideName("");
          setPendingRidePolyline(null);
          setViewedRideId(null);
        }}
      >
        <View style={styles.saveRouteModalOverlay}>
          <View style={styles.saveRouteModalContent}>
            <Text style={styles.saveRouteModalTitle}>
              {viewedRideId ? "Save as Route" : "Save Ride"}
            </Text>
            
            <TextInput
              style={styles.saveRouteInput}
              placeholder={viewedRideId ? "Route name" : "Ride name (optional)"}
              placeholderTextColor={theme.colors.primaryLight}
              value={saveRideName}
              onChangeText={setSaveRideName}
              returnKeyType="done"
            />

            <View style={styles.saveRouteModalButtons}>
              <TouchableOpacity
                style={[styles.saveRouteModalButton, styles.saveRouteModalButtonSave]}
                onPress={() => handleSaveRide(saveRideName || undefined)}
              >
                <Text style={styles.saveRouteModalButtonText}>
                  {viewedRideId ? "Save as Route" : "Save"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveRouteModalButton, styles.saveRouteModalButtonCancel]}
                onPress={() => {
                  setShowSaveRideModal(false);
                  setSaveRideName("");
                  setPendingRidePolyline(null);
                  setViewedRideId(null);
                }}
              >
                <Text style={styles.saveRouteModalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Route Type Selector Modal */}
      <MapRouteTypeSelector
        visible={showRouteTypeSelector}
        onClose={() => setShowRouteTypeSelector(false)}
      />

    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  navigationArrow: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#2196F3",
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

  miniMapContainer: {
    position: "absolute",
    bottom: 125,
    right: 12,
    width: 110,
    height: 130,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    elevation: 12,
    zIndex: 5000,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
    bottom: 70,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.accentMid, // default blue
    zIndex: 9999,
    elevation: 6,
  },

  postboxError: {
    backgroundColor: theme.colors.danger, // red
  },

  postboxWarning: {
    backgroundColor: "#f59e0b", // amber/orange
  },

  postboxSuccess: {
    backgroundColor: theme.colors.success, // green
  },

  postboxInfo: {
    backgroundColor: theme.colors.accentMid, // blue
  },

  junctionPanel: {
    position: "absolute",
    bottom: 125,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#2196F3",
    borderWidth: 3,
    borderColor: "rgba(245, 245, 240, 0.95)",
    zIndex: 2000,
    elevation: 8,
    gap: 16,
  },
  junctionIcon: {
    marginRight: 4,
  },
  junctionContent: {
    justifyContent: "center",
  },
  junctionDistance: {
    fontSize: 48,
    fontWeight: "700",
    color: "rgba(245, 245, 240, 0.95)",
    lineHeight: 56,
  },
  junctionRemaining: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(245, 245, 240, 0.8)",
    marginTop: 4,
  },
  junctionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(245, 245, 240, 0.95)",
    marginTop: 4,
  },
  junctionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fbbf24",
  },
  junctionText: {
    fontSize: 12,
    color: "#e5e7eb",
  },

  postboxTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },

  postboxText: {
    fontSize: 13,
    color: "#ffffff",
  },

  offlineBanner: {
    position: "absolute",
    bottom: 70,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryMid || "#1a2332",
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger || "#ef4444",
    zIndex: 1500,
    elevation: 4,
  },

  offlineBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textMuted || "#e5e7eb",
    flex: 1,
  },
  
  filterPanel: {
    position: "absolute",
    top: 68,
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 10,
  },

  pointMenuText: {
    color: theme.colors.textMuted,
    fontSize: 18,
    fontWeight: "500",
    flex: 1,
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

  refreshMenuOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  refreshMenu: {
    backgroundColor: theme.colors.primaryMid,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 8,
    paddingHorizontal: 16,
    elevation: 8,
  },

  refreshMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },

  refreshMenuText: {
    color: theme.colors.textMuted,
    fontSize: 18,
    fontWeight: "500",
    flex: 1,
  },

  refreshMenuCancel: {
    justifyContent: "center",
    marginTop: 4,
  },

  refreshMenuCancelText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    opacity: 0.8,
  },

  saveRouteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  saveRouteModalContent: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 20,
    padding: 24,
    paddingBottom: 32,
    width: "85%",
    maxWidth: 350,
  },

  saveRouteModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.accentMid,
    marginBottom: 16,
  },

  saveRouteInput: {
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
    color: theme.colors.accentMid,
    borderWidth: 1,
    borderColor: theme.colors.accentDark,
  },

  saveRouteModalButtons: {
    flexDirection: "row",
    gap: 12,
  },

  saveRouteModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  saveRouteModalButtonSave: {
    backgroundColor: theme.colors.accentDark,
  },

  saveRouteModalButtonCancel: {
    backgroundColor: theme.colors.primaryMid,
    borderWidth: 1,
    borderColor: theme.colors.accentDark,
  },

  saveRouteModalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primaryDark,
  },

  saveRouteModalButtonTextCancel: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },

  // Rider location markers
  riderMarker: {
    alignItems: "center",
    justifyContent: "flex-end",
  },

  riderIconContainer: {
    position: "relative",
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

    riderAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      resizeMode: "cover",
    },

  riderStatusDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.background,
    bottom: 0,
    right: 0,
  },

  riderLabel: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    maxWidth: 140,
    borderWidth: 2,
    borderColor: theme.colors.primaryDark,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  riderName: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});


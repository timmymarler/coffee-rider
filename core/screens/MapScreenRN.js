import { db } from "@config/firebase";
import { TabBarContext } from "@context/TabBarContext";
import { debugLog } from "@core/utils/debugLog";
import { incMetric } from "@core/utils/devMetrics";
import Constants from "expo-constants";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

import * as KeepAwake from "expo-keep-awake";
import * as Location from "expo-location";
import { classifyPoi } from "../map/classify/classifyPois";
import { applyFilters } from "../map/filters/applyFilters";
/* Ready for routing */
import { decode } from "@mapbox/polyline";
import { SearchBar } from "../map/components/SearchBar";
import { fetchRoute } from "../map/utils/fetchRoute";

import { saveRoute } from "@/core/map/routes/saveRoute";
import { openNavigationWithWaypoints } from "@/core/map/utils/navigation";
import { AuthContext } from "@context/AuthContext";
import { GOOGLE_PHOTO_LIMITS } from "@core/config/photoPolicy";
import useActiveRide from "@core/map/routes/useActiveRide";
import useActiveRideLocations from "@core/map/routes/useActiveRideLocations";
import useWaypoints from "@core/map/waypoints/useWaypoints";
import { WaypointsContext } from "@core/map/waypoints/WaypointsContext";
import WaypointsList from "@core/map/waypoints/WaypointsList";
import { getCapabilities } from "@core/roles/capabilities";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import theme from "@themes";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { RIDER_AMENITIES } from "../config/amenities/rider";
import { RIDER_CATEGORIES } from "../config/categories/rider";
import { RIDER_SUITABILITY } from "../config/suitability/rider";
import { geocodeAddress, getPlaceLabel } from "../lib/geocode";

const mapStyleLight = require("@config/mapStyleLight.json");
const mapStyleDark = require("@config/mapStyleDark.json");

const RECENTER_ZOOM = Platform.OS === "ios" ? 2.5 : 13; // Android: 13, iOS: 2.5
const FOLLOW_ZOOM = Platform.OS === "ios" ? 6 : 16; // Android: 16, iOS: 6 - More zoomed out for route visibility
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
    ROUNDABOUT_ENTER: { icon: "rotate-clockwise", label: "Enter roundabout" },
    ROUNDABOUT_EXIT: { icon: "rotate-clockwise", label: "Exit roundabout" },
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
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 56; // matches FloatingTabBar height
  const FLOATING_MARGIN = 1; // sit almost flush with the tab bar
  const SAVE_BUTTON_GAP = 50; // vertical gap between save and navigate buttons

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

  const [searchNotice, setSearchNotice] = useState(null);
  const [postbox, setPostbox] = useState(null);
  const isSearchActive = !!activeQuery;
  const [mapKey, setMapKey] = useState(0);
  const isLoadingSavedRouteRef = useRef(false);

  const skipNextFollowTickRef = useRef(false);
  const skipNextRegionChangeRef = useRef(false);
  const skipRegionChangeUntilRef = useRef(0);
  const isAnimatingRef = useRef(false); // Track if we're doing a programmatic animation
  const followMeInactivityRef = useRef(null); // Timeout for 15-min inactivity
  const lastUserPanTimeRef = useRef(null); // Track when user last manually panned
  const {
    waypoints,
    addFromPlace,
    addFromMapPress,
    formatPoint,
    clearWaypoints,
  } = useWaypoints();
  
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
    console.log('[MapScreenRN] activeRide changed:', activeRide?.rideId || 'null');
    setActiveRide(activeRide);
    activeRideRef.current = activeRide;
    endRideRef.current = endRide;
  }, [activeRide, endRide, setActiveRide]);
  
  const canSaveRoute = 
    capabilities.canSaveRoutes &&
    routeMeta &&
    (routeDestination || waypoints.length > 0);
  const [lastEncodedPolyline, setLastEncodedPolyline] = useState(null);

  const [showSaveRouteModal, setShowSaveRouteModal] = useState(false);
  const [saveRouteName, setSaveRouteName] = useState("");
  const [currentLoadedRouteId, setCurrentLoadedRouteId] = useState(null);

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

  const navButtonBottom = insets.bottom + TAB_BAR_HEIGHT + FLOATING_MARGIN;
  const saveButtonBottom = navButtonBottom + SAVE_BUTTON_GAP;
  const [pendingMapPoint, setPendingMapPoint] = useState(null);
  const [showAddPointMenu, setShowAddPointMenu] = useState(false);
  const [showMarkerMenu, setShowMarkerMenu] = useState(false);
  const [pendingMarker, setPendingMarker] = useState(null);
  const [manualStartPoint, setManualStartPoint] = useState(null);
  const [showRefreshRouteMenu, setShowRefreshRouteMenu] = useState(false);
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
          console.log(`[REFRESH] Snapping to next waypoint ahead at index ${nextWaypointIdx} (${searchEndIdx}/${routeCoords.length}), distance: ${snapDistance.toFixed(0)}m`);
        } else if (minDistance < 500) {
          // Fallback: if very close to current route, snap to closest point
          snapPoint = routeCoords[closestIdx];
          console.log(`[REFRESH] Close to route, snapping to closest point at index ${closestIdx}, distance: ${minDistance.toFixed(0)}m`);
        }
      }

      // Determine final destination (same as buildRoute logic)
      const finalDestination = routeDestination
        ? {
            latitude: routeDestination.latitude,
            longitude: routeDestination.longitude,
          }
        : {
            latitude: waypoints[waypoints.length - 1].lat,
            longitude: waypoints[waypoints.length - 1].lng,
          };

      // If we have a snap point, route through it to maintain the path
      let routeWaypoints = waypoints.map(wp => ({
        latitude: wp.lat,
        longitude: wp.lng,
      }));

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
      const result = await fetchRoute({
        origin: userLocation,
        destination: finalDestination,
        waypoints: routeWaypoints,
      });

      if (!result?.polyline) {
        console.warn("[REFRESH] No polyline in result");
        return;
      }

      const decoded = decode(result.polyline).map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));

      setRouteCoords(decoded);
      setRouteDistanceMeters(result.distanceMeters ?? result.distance);
      setRouteMeta({
        distanceMeters: result.distanceMeters ?? result.distance,
        durationSeconds: result.durationSeconds ?? result.duration,
      });
      setRouteSteps(result.steps ?? []);
      setCurrentStepIndex(0);

      console.log("[REFRESH] Route refreshed - routing forward to next waypoint");
    } catch (error) {
      console.error("[REFRESH] Error refreshing route:", error);
    }
  };

  const handleAddWaypoint = () => {
    setSelectedPlaceId(null);
    isLoadingSavedRouteRef.current = false;
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
          console.log('[MapScreen] Leaving map screen - ending active ride');
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
          console.log('[MapScreen] App going to background - ending active ride');
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
      console.log("[MapScreenRN] 📍 Places listener updated, total places:", places.length);
      if (newlyCreatedPlace) {
        const isNewPlaceInList = places.find(p => p.id === newlyCreatedPlace.id);
        console.log("[MapScreenRN] Newly created place in listener?", isNewPlaceInList ? "✓ YES" : "✗ NO", "Place ID:", newlyCreatedPlace.id);
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

  // Monitor newly created places and ensure they're in crPlaces
  useEffect(() => {
    if (!newlyCreatedPlace) return;

    const checkNewPlace = async () => {
      try {
        // Small delay to allow Firestore to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const newPlaceInList = crPlaces.find(p => p.id === newlyCreatedPlace.id);
        if (!newPlaceInList) {
          console.log("[MapScreenRN] 🔄 Newly created place not yet in crPlaces, triggering refresh...");
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
        Alert.alert(
          "Location Required",
          "Location permission is required to use this feature. Please enable it in your device settings."
        );
        return null;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation(current.coords);
      return current.coords;
    } catch (e) {
      Alert.alert(
        "Location Error",
        "Unable to determine your current location. Please check your settings."
      );
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
    // Explicitly disable Follow Me when user taps the red recenter button
    setFollowUser(false);
    clearFollowMeInactivityTimeout();
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
        console.log('[MAP] Follow Me disabled after 15 minutes of inactivity');
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

    // Turning ON: recenter + zoom + tilt FIRST
    skipNextFollowTickRef.current = true; // prevent immediate follow tick overriding
    skipNextRegionChangeRef.current = true; // prevent the recenter animation from disabling follow
    skipRegionChangeUntilRef.current = Date.now() + 2000;
    await recenterOnUser({ zoom: FOLLOW_ZOOM, pitch: 25 });

    // Now enable follow mode and start 15-minute inactivity timer
    setFollowUser(true);
    resetFollowMeInactivityTimeout();
  }

  /* ------------------------------------------------------------ */
  /* ROUTE TO HOME                                                */
  /* ------------------------------------------------------------ */
  async function routeToHome() {
    console.log("[ROUTE_TO_HOME] Starting...");
    const homeAddress = auth?.profile?.homeAddress;
    console.log("[ROUTE_TO_HOME] homeAddress:", homeAddress);
    
    if (!homeAddress || !homeAddress.trim()) {
      console.log("[ROUTE_TO_HOME] No home address set");
      await debugLog("ROUTE_TO_HOME", "No home address set");
      Alert.alert(
        "No Home Address",
        "Please add your home address in the Profile screen to use this feature."
      );
      return;
    }

    if (!userLocation) {
      console.log("[ROUTE_TO_HOME] No user location");
      await debugLog("ROUTE_TO_HOME", "No user location available");
      Alert.alert("No Location", "Unable to determine your current location.");
      return;
    }

    try {
      console.log("[ROUTE_TO_HOME] Geocoding address...");
      await debugLog("ROUTE_TO_HOME", "Geocoding address: " + homeAddress);
      
      // Geocode the home address
      const homeCoords = await geocodeAddress(homeAddress);
      console.log("[ROUTE_TO_HOME] Geocoded coords:", homeCoords);
      
      if (!homeCoords) {
        console.log("[ROUTE_TO_HOME] Geocoding failed");
        await debugLog("ROUTE_TO_HOME", "Geocoding failed for address", { address: homeAddress });
        Alert.alert(
          "Invalid Address",
          "Unable to find your home address. Please check it in your Profile settings."
        );
        return;
      }

      console.log("[ROUTE_TO_HOME] Clearing waypoints and setting destination...");
      // Clear existing waypoints and route
      clearWaypoints();
      setRouteCoords([]);
      routeFittedRef.current = false;
      setRouteClearedByUser(false); // Ensure route building is not blocked

      // Set home as destination - this will trigger buildRoute via useEffect
      console.log("[ROUTE_TO_HOME] Setting route destination to home:", homeCoords);
      await debugLog("ROUTE_TO_HOME", "Route to home initiated", { lat: homeCoords.lat, lng: homeCoords.lng });
      
      setRouteDestination({
        latitude: homeCoords.lat,
        longitude: homeCoords.lng,
        name: "Home",
      });
      setIsHomeDestination(true);
      
      // Enable Follow Me mode to guide to home
      console.log("[ROUTE_TO_HOME] Enabling Follow Me...");
      skipNextFollowTickRef.current = true;
      skipNextRegionChangeRef.current = true;
      await recenterOnUser({ zoom: FOLLOW_ZOOM });
      setFollowUser(true);
      
      console.log("[ROUTE_TO_HOME] Destination set and Follow Me enabled");
      await debugLog("ROUTE_TO_HOME", "Follow Me enabled - tracking route home");
    } catch (error) {
      console.error("Error routing to home:", error);
      await debugLog("ROUTE_TO_HOME", "Error: " + error.message, { error });
      Alert.alert("Error", "Failed to create route to home.");
    }
  }

  useEffect(() => {
    if (!followUser) return;
    if (!userLocation) return;

    if (skipNextFollowTickRef.current) {
      skipNextFollowTickRef.current = false;
      return;
    }

    // Reset inactivity timeout on each location update while Follow Me is active
    // This keeps Follow Me on as long as the user is moving
    resetFollowMeInactivityTimeout();

    // Only update camera in navigation mode (Follow Me)
    if (isNavigationMode && userLocation.heading !== undefined && userLocation.heading !== -1) {
      recenterOnUser({ heading: userLocation.heading, pitch: 25, zoom: FOLLOW_ZOOM });
    }
  }, [userLocation, followUser, isNavigationMode]);

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
    // Advance to next step when within ~30m of end
    if (d !== null && d < 30 && idx < routeSteps.length - 1) {
      setCurrentStepIndex(idx + 1);
    }
  }, [userLocation, isNavigationMode, routeSteps, currentStepIndex]);

  // Keep screen awake during Follow Me or active ride
  useEffect(() => {
    if (followUser || activeRide) {
      KeepAwake.activateKeepAwake();
      console.log('[MAP] Screen keep-awake activated (Follow Me or active ride)');
      return () => {
        // Keep awake will be deactivated when both Follow Me and active ride end
      };
    } else {
      KeepAwake.deactivateKeepAwake();
      console.log('[MAP] Screen keep-awake deactivated');
    }
  }, [followUser, activeRide]);


  useEffect(() => {
    setMapActions({
      recenter: handleRecentre,
      toggleFollow: toggleFollowMe,
      isFollowing: () => followUser,
      showRefreshMenu: () => setShowRefreshRouteMenu(true),
      canRefreshRoute: () => userLocation && (waypoints.length > 0 || routeDestination),
      refreshRoute: handleRefreshRouteToNextWaypoint,
      routeToHome: routeToHome,
      endRide: endRide,
    });

    return () => {
      setMapActions(null);
    };
  }, [followUser, userLocation, waypoints, routeDestination, auth?.profile?.homeAddress, endRide]);

  useEffect(() => {
    let subscription;

    (async () => {
      console.log("[MAP] Requesting location permissions...");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("[MAP] Location permission denied");
        return;
      }

      console.log("[MAP] Getting current position...");
      // 1️⃣ IMMEDIATE location (fixes first tap issue)
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log("[MAP] Location set:", current.coords);
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
                  console.log("[MAP] Using dead reckoning estimate based on heading");
                  debugLog("DEAD_RECKONING", `Estimated position using heading (${estimatedDistance.toFixed(0)}m ahead)`, { estimatedDistance });
                }
              }
              
              if (coordsToUse === location.coords) return; // No valid estimate, skip update
            }
            
            // Filter out movements < 3m (reduces jitter)
            if (userLocation) {
              const dist = distanceBetween(userLocation, coordsToUse);
              if (dist < MIN_LOCATION_MOVE_DISTANCE) {
                console.log(`[MAP] Movement too small (${dist.toFixed(1)}m), ignoring`);
                debugLog("LOCATION_FILTERED", `Movement too small: ${dist.toFixed(1)}m (threshold: ${MIN_LOCATION_MOVE_DISTANCE}m)`, { distance: dist });
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
        }
      );
    })();

    return () => {
      console.log("[MAP] Cleaning up location subscription");
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

    // Disable Follow Me only on user pan, not on programmatic animations
    // isAnimatingRef detects our own recenterOnUser() calls
    // skipNextRegionChangeRef catches route-to-home and toggle-on animations
    if (followUser && !isAnimatingRef.current && !skipNextRegionChangeRef.current) {
      console.log('[MAP] User manually panned - disabling Follow Me');
      lastUserPanTimeRef.current = Date.now();
      setFollowUser(false);
      clearFollowMeInactivityTimeout();
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

    loadSavedRouteById(pendingSavedRouteId);
    setPendingSavedRouteId(null);
    
    // Enable Follow Me if requested (e.g., when starting an active ride)
    if (enableFollowMeAfterLoad) {
      setEnableFollowMeAfterLoad(false);
      // Use a delay to ensure route is fully loaded, fitted, and map is ready
      setTimeout(() => {
        if (!followUser && userLocation) {
          console.log('[MAP] Enabling Follow Me after route load');
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
    setManualStartPoint(null); 
    routeFittedRef.current = false;
    setCurrentLoadedRouteId(null);
    setFollowUser(false);          // Disable Follow Me when clearing route
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

      return (json?.places || [])
        .map((p) => mapGooglePlace(p, capabilities))
        .filter(p => p.latitude && p.longitude);
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

      try {
        const results = await doTextSearch({
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
        setPostbox({
          type: "error",
          title: "Search Error",
          message: error?.message || "Failed to search. Please check your connection.",
        });
        setGooglePois([]);
        return;
      }

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
    if (isLoadingSavedRouteRef.current) return;
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

  // Log routeCoords changes for debugging polyline visibility
  useEffect(() => {
    if (routeCoords && routeCoords.length > 0) {
      console.log("[POLYLINE] routeCoords updated with", routeCoords.length, "coordinates");
    } else {
      console.log("[POLYLINE] routeCoords cleared");
    }
  }, [routeCoords]);


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

  async function buildRoute({ destinationOverride = null, requestId } = {}) {
    console.log("[buildRoute] Starting - destination:", routeDestination, "waypoints:", waypoints.length);
    if (!routeDestination && waypoints.length === 0) {
      console.log("[buildRoute] No destination or waypoints, returning");
      return;
    }
    if (!userLocation) {
      console.log("[buildRoute] No user location, returning");
      return;
    }

    const destination =
      destinationOverride ||
      routeDestination ||
      null;

    if (!destination && waypoints.length === 0) {
      console.log("[buildRoute] No destination and no waypoints, returning");
      return;
    }

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

    console.log("[buildRoute] fetchRoute returned:", result);

      // Always set routed total distance (meters) for use in WaypointsList
      if (typeof result?.distanceMeters === 'number' && result.distanceMeters > 0) {
        setRouteDistanceMeters(result.distanceMeters);
      } else if (typeof result?.distance === 'number' && result.distance > 0) {
        setRouteDistanceMeters(result.distance);
      } else {
        setRouteDistanceMeters(null);
      }

    if (!result?.polyline) {
      console.log("[buildRoute] No polyline in result, returning");
      return;
    }
    if (requestId !== routeRequestId.current) {
      console.log("[buildRoute] Request ID mismatch, returning");
      return;
    }

    const decoded = decode(result.polyline).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));

    // Simplify polyline to reduce rendering lag - removes ~70% of points
    // while maintaining visual accuracy
    const simplified = simplifyPolyline(decoded, 0.00005); // ~5m tolerance
    console.log("[buildRoute] Decoded", decoded.length, "points, simplified to", simplified.length, "points");
    
    console.log("[buildRoute] Setting route coords with", simplified.length, "points");
    await debugLog("ROUTE_BUILT", `Route built: ${simplified.length} points, ${(result.distanceMeters / 1000).toFixed(1)}km`, { points: simplified.length, distanceKm: (result.distanceMeters / 1000).toFixed(1) });
    setRouteCoords(simplified);
    console.log("[buildRoute] setRouteCoords call complete");
    // 🔑 ADD THIS
    setRouteMeta({
      distanceMeters: result.distanceMeters ?? result.distance,
      durationSeconds: result.durationSeconds ?? result.duration,
    });
    setRouteSteps(result.steps ?? []);
    setCurrentStepIndex(0);

    // Only auto-fit if not already fitted AND not in Follow Me mode
    if (!routeFittedRef.current && !followUser) {
      routeFittedRef.current = true;

      mapRef.current?.fitToCoordinates(simplified, {
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
    setCurrentLoadedRouteId(routeId);
  }

  function loadSavedRoute(route) {
    clearRoute();
    clearWaypoints();
    isLoadingSavedRouteRef.current = true;

    if (route.origin) {
      setManualStartPoint({
        latitude: route.origin.lat,
        longitude: route.origin.lng,
      });
    }

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
      setLastEncodedPolyline(route.routePolyline);

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

    setRoutingActive(true);
    isLoadingSavedRouteRef.current = true;
  }

  function handleNavigate(placeOverride = null) {
    const destination = placeOverride || routeDestination;
    if (!userLocation) return;

    // Build navigation waypoints starting with saved origin if present
    const navWaypoints = [];

    if (manualStartPoint) {
      navWaypoints.push({
        lat: manualStartPoint.latitude,
        lng: manualStartPoint.longitude,
        title: "Route start",
      });
    }

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

    const isSearchHitCR = activeQuery && isCr && matchesQuery(poi, activeQuery);
    const isSearchHitGoogle = activeQuery && !isCr && matchesQuery(poi, activeQuery);

    let markerMode = "default";
    let zIndex = 1;
    if (isDestination) {
      markerMode = "destination";
      zIndex = 1000;
    } else if (isSearchHitCR) {
      markerMode = "searchCR";
      zIndex = 800; // Higher than searchGoogle
    } else if (isSearchHitGoogle) {
      markerMode = "searchGoogle";
      zIndex = 700; // Lower than searchCR (partial matches)
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
      searchCR: {
        fill: "#FFD700",         // bright gold for current places in search
        circle: "#FFA500",
        stroke: categoryStroke,  // category-specific outline
      },
      searchGoogle: {
        fill: "#FFEAA7",         // lighter gold for search results
        circle: "#FFB84D",
        stroke: categoryStroke,  // category-specific outline
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
          <SvgPin icon={icon} fill={fill} circle={circle} stroke={stroke} />
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
          showsUserLocation={!isNavigationMode}
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
          {/* Navigation arrow marker - show if Follow Me or active ride is enabled */}
          {isNavigationMode && userLocation && (
            <Marker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
              rotation={userLocation.heading || 0}
              zIndex={1000}
              tracksViewChanges={false}
            >
              <View style={styles.navigationArrow}>
                <MaterialCommunityIcons
                  name="navigation"
                  size={32}
                  color={theme.colors.primary}
                />
              </View>
            </Marker>
          )}

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
                fill={theme.colors.accentMid}
                circle={theme.colors.primaryMid}
                stroke={theme.colors.primaryDark}
              />
            </Marker>
          )}

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

          {/* Other riders' locations (real-time) */}
          {riderLocations.map((rider) => (
            <Marker
              key={`rider-${rider.id}`}
              coordinate={{
                latitude: rider.latitude,
                longitude: rider.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={600}
            >
              <View style={styles.riderMarker}>
                <View style={styles.riderIconContainer}>
                  {rider.userAvatar ? (
                    <Image
                      source={{ uri: rider.userAvatar }}
                      style={styles.riderAvatar}
                    />
                  ) : (
                    <MaterialCommunityIcons 
                      name="account-circle" 
                      size={48} 
                      color={theme.colors.accentLight}
                    />
                  )}
                  <View style={styles.riderStatusDot} />
                </View>
                <View style={styles.riderLabel}>
                  <Text style={styles.riderName} numberOfLines={1}>
                    {rider.userName || 'Rider'}
                  </Text>
                </View>
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
                      color={active ? theme.colors.accentMid : theme.colors.background}
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
                      fill={active ? theme.colors.accentMid : theme.colors.primaryLight}
                      circle={active ? theme.colors.accentMid : theme.colors.accentDark}
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
                      color={active ? theme.colors.accentMid : theme.colors.background}
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

      {/* Junction panel (top-left) during navigation - helmet visible */}
      {isNavigationMode && hasRoute && routeSteps && routeSteps.length > 0 && (
        (() => {
          // Show the NEXT step's maneuver (what's coming), not the current step
          const nextStepIndex = Math.min(currentStepIndex + 1, routeSteps.length - 1);
          const step = routeSteps[nextStepIndex];
          const m = step?.maneuver || "STRAIGHT";
          const meta = MANEUVER_ICON_MAP[m] || MANEUVER_ICON_MAP.STRAIGHT;
          const dist = nextJunctionDistance;
          const distText = dist != null ? formatDistanceImperial(dist) : "";
          return (
            <View style={styles.junctionPanel}>
              {/* Large direction icon */}
              <MaterialCommunityIcons name={meta.icon} size={64} color="rgba(245, 245, 240, 0.95)" style={styles.junctionIcon} />
              
              {/* Distance and label section */}
              <View style={styles.junctionContent}>
                {distText ? (
                  <Text style={styles.junctionDistance}>{distText}</Text>
                ) : null}
                <Text style={styles.junctionLabel}>{meta.label}</Text>
                {routeDistanceMeters && routeMeta?.durationSeconds && (
                  <Text style={styles.junctionRemaining}>
                    {formatDistanceImperial(routeDistanceMeters)} • {(() => {
                      const totalMins = Math.round(routeMeta.durationSeconds / 60);
                      const hours = Math.floor(totalMins / 60);
                      const mins = totalMins % 60;
                      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                    })()} remaining
                  </Text>
                )}
              </View>
              </View>
            </View>
          );
        })()
      )}
      {postbox && (
        <View style={styles.postbox}>
          <Text style={styles.postboxTitle}>{postbox.title}</Text>
          <Text style={styles.postboxText}>{postbox.message}</Text>
        </View>
      )}

      {!followUser && !activeRide && (
        <WaypointsList
          waypoints={displayWaypoints}
          onClearAll={clearNavigationIntent}
          routeOrigin={manualStartPoint || userLocation}
          // Always pass routedTotalMeters from state, fallback to routeMeta if needed
          routedTotalMeters={
            typeof routeDistanceMeters === 'number' && routeDistanceMeters > 0
              ? routeDistanceMeters
              : (typeof routeMeta?.distanceMeters === 'number' && routeMeta.distanceMeters > 0
                  ? routeMeta.distanceMeters
                  : undefined)
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
                color={theme.colors.accentMid}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.pointMenuText}>Add waypoint</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                closeMarkerMenu();
                if (pendingMarker) {
                  setManualStartPoint({
                    latitude: pendingMarker.latitude,
                    longitude: pendingMarker.longitude,
                  });
                }
              }}
              style={({ pressed }) => [
                styles.pointMenuItem,
                pressed && { backgroundColor: theme.colors.primaryDark },
              ]}
            >
              <MaterialCommunityIcons
                name="flag-triangle"
                size={26}
                color={theme.colors.accentMid}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.pointMenuText}>Add as start point</Text>
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
                color={theme.colors.accentMid}
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
            {console.log("[MENU] Menu visible. routeCoords.length:", routeCoords.length, "canCreateCrPlaces:", capabilities.canCreateCrPlaces)}
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
                  color={theme.colors.accentMid}
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
                color={theme.colors.accentMid}
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
                color={theme.colors.accentMid}
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
                color={theme.colors.accentMid}
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
                color={theme.colors.accentMid}
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
    backgroundColor: "transparent",
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

  junctionPanel: {
    position: "absolute",
    top: 20,
    left: 20,
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
    color: "#6ee7b7", // mint
    marginBottom: 2,
  },

  postboxText: {
    fontSize: 13,
    color: "#ecfdf5",
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
    backgroundColor: theme.colors.accentMid,
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
    backgroundColor: theme.colors.primary,
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
    backgroundColor: theme.colors.accentMid,
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


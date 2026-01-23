import { fetchGooglePhotoRefs } from "@/core/map/utils/fetchGooglePhotoRefs";
import { fetchGoogleRating } from "@/core/map/utils/fetchGoogleRating";
import { getGoogleDetails } from "@/core/map/utils/getGoogleDetails";
import { formatWeekdayText, getOpeningStatus } from "@/core/map/utils/openingHours";
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { getCapabilities } from "@core/roles/capabilities";
import { incMetric } from "@core/utils/devMetrics";
import { uploadImage } from "@core/utils/uploadImage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import Constants from 'expo-constants';
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { RIDER_CATEGORIES } from "../../config/categories/rider";


const PLACE_CATEGORIES = RIDER_CATEGORIES;
const screenWidth = Dimensions.get("window").width;
const MAX_USER_PHOTOS_PER_PLACE = 2;
const GOOGLE_KEY = Constants.expoConfig?.extra?.googlePlacesApiKey;

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const defaultSuitability = {
  bikers: false,
  scooters: false,
  cyclists: false,
  walkers: false,
  cars: false,
  evDrivers: false,
};

const defaultAmenities = {
  parking: false,
  outdoorSeating: false,
  toilets: false,
  disabledAccess: false,
  petFriendly: false,
  evCharger: false,
};

// UI key → Firestore key
const AMENITY_KEY_MAP = {
  parking: "parking",
  evCharger: "ev_charger",
  toilets: "toilets",
  petFriendly: "pet_friendly",
  disabledAccess: "disabled_access",
  outdoorSeating: "outdoor_seating",
};

/* ------------------------------------------------------------------ */

export default function PlaceCard({
  place,
  onClose,
  userLocation,
  hasRoute = false,
  routeMeta = null,
  onPlaceCreated,
  onClearRoute = null,
  onRoute,
  onNavigate,
}) {
  const [googlePhotos, setGooglePhotos] = useState([]);
  const [googleRatingLive, setGoogleRatingLive] = useState(null);
  const [googleRatingCountLive, setGoogleRatingCountLive] = useState(null);
  const [loadingGooglePhotos, setLoadingGooglePhotos] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [currentPlace, setCurrentPlace] = useState(place);
  const openingStatus = getOpeningStatus(currentPlace.regularOpeningHours);
  const weekList = formatWeekdayText(currentPlace.regularOpeningHours);

  const safePlace = {
    ...currentPlace,
    googlePlaceId: currentPlace.googlePlaceId || null,
    regularOpeningHours: currentPlace.opening_hours || currentPlace.regularOpeningHours || null,
    photos: {
      google: Array.isArray(currentPlace.googlePhotoRefs)
        ? currentPlace.googlePhotoRefs
        : [],
      cr: Array.isArray(currentPlace.photos?.cr)
        ? currentPlace.photos.cr
        : [],
    },
    suitability: Array.isArray(currentPlace.suitability)
      ? currentPlace.suitability
      : Object.keys(currentPlace.suitability || {}),

    amenities: Array.isArray(currentPlace.amenities)
      ? currentPlace.amenities
      : Object.keys(currentPlace.amenities || {}),
    crRatings: currentPlace.crRatings ?? {
      average: null,
      count: 0,
      users: {},
    },
    latitude:
      typeof currentPlace.latitude === "number"
        ? currentPlace.latitude
        : currentPlace.location?.latitude ?? null,
    longitude:
      typeof currentPlace.longitude === "number"
        ? currentPlace.longitude
        : currentPlace.location?.longitude ?? null,
    address:
      currentPlace.address ||
      currentPlace.formattedAddress ||
      currentPlace.vicinity ||
      null,
  };

  const styles = createStyles(theme);
  const auth = useContext(AuthContext);
  const user = auth?.user || null;
  const role = auth?.profile?.role || "guest"; // or auth.role if that’s what you store
  const capabilities = getCapabilities(role);
  const canNavigate = capabilities.canNavigate === true;
  const canRate = capabilities.canRate === true;
  const currentUid = user?.uid || null;
  const isManualOnly = place?.source === "manual";
  const isGoogle = place?.source === "google";
  // 🔑 NORMALISE Google place id (ABSOLUTELY REQUIRED)
  const googlePlaceId =
    safePlace.googlePlaceId ||
    (safePlace.source === "google" ? safePlace.id : null);
  const isNewPlace =
    safePlace._temp === true || safePlace.source === "google";

  const isGoogleNew = place?.source === "google-new";
  const isCr = place?.source === "cr";
  const isRealCr = safePlace.source === "cr" && !safePlace._temp;
  const uid = user?.uid;
  const userCrRating =
    uid && safePlace.crRatings?.users?.[uid]?.rating
      ? safePlace.crRatings.users[uid].rating
      : 0;
  const [selectedRating, setSelectedRating] = useState(userCrRating);

  const canAddPlace =
    (safePlace.source === "google" || safePlace._temp === true) &&
    capabilities.canAddVenue === true &&
    !!currentUid;
  const isCrPlace = safePlace.source === "cr";  
  //const isEditable = safePlace.source === "google" || safePlace._temp === true ; // add flow only (for now)
  useEffect(() => {
    setSelectedRating(userCrRating);
  }, [userCrRating, place?.id]);


    /* ------------------------------------------------------------------ */
  /* LOCAL STATE                                                        */
  /* ------------------------------------------------------------------ */

  const [manualName, setManualName] = useState(
    (isGoogleNew || safePlace._temp) ? safePlace.title ?? "" : ""
  );

  const [manualCategory, setManualCategory] = useState(
    (isGoogleNew || safePlace._temp) ? safePlace.category ?? null : null
  );
  const formattedAddress = useMemo(
    () => formatAddress(place.address),
    [place.address]
  );

  const [commentText, setCommentText] = useState("");
  const [ratingInput, setRatingInput] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [localPlace, setLocalPlace] = useState(place);
  // Set initial category: use place.category if present (from search result), else default to 'cafe'
  const [category, setCategory] = useState(() => {
    if (place?.category && typeof place.category === 'string') {
      return place.category;
    }
    return "cafe";
  });
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  const scrollViewRef = useRef(null);
  const commentInputRef = useRef(null);

  const [suitabilityState, setSuitabilityState] = useState(defaultSuitability);
  const [amenitiesState, setAmenitiesState] = useState(defaultAmenities);

  const toggleFlagMap = (key, setState) => {
    setState(prev => {
      const currentlyOn = prev[key];

      if (currentlyOn && !capabilities.isAdmin) {
        return prev; // Pro cannot remove
      }

      return { ...prev, [key]: !currentlyOn };
    });
  };

  const showNoGooglePhotosMessage =
    capabilities.canViewGooglePhotos &&
    googlePlaceId &&
    googlePhotos.length === 0;

  useEffect(() => {
    const state = { ...defaultSuitability };
    if (Array.isArray(safePlace?.suitability)) {
      safePlace.suitability.forEach(key => {
        if (key in state) state[key] = true;
      });
    }
    setSuitabilityState(state);
  }, [safePlace?.id]);

  useEffect(() => {
    const state = { ...defaultAmenities };

    if (Array.isArray(safePlace?.amenities)) {
      safePlace.amenities.forEach((dbKey) => {
        const uiKey = Object.keys(AMENITY_KEY_MAP).find(
          k => AMENITY_KEY_MAP[k] === dbKey
        );

        if (uiKey && uiKey in state) {
          state[uiKey] = true;
        }
      });
    }

    setAmenitiesState(state);
  }, [safePlace?.id]);

  useEffect(() => {
    if (!googlePlaceId) return;
    if (!capabilities?.canViewGooglePhotos) return;
    if (googlePhotos.length > 0 && googleRatingLive !== null) return;

    let mounted = true;

    async function loadGoogleDetails() {
      const [refs, ratingInfo] = await Promise.all([
        googlePhotos.length > 0
          ? Promise.resolve(googlePhotos)
          : fetchGooglePhotoRefs(googlePlaceId, 1),
        fetchGoogleRating(googlePlaceId),
      ]);

      if (!mounted) return;

      if (googlePhotos.length === 0) setGooglePhotos(refs || []);

      if (ratingInfo) {
        setGoogleRatingLive(ratingInfo.rating);
        setGoogleRatingCountLive(ratingInfo.userRatingCount);
      }
    }

    loadGoogleDetails();
    return () => (mounted = false);
  }, [googlePlaceId, capabilities?.canViewGooglePhotos]);

  useEffect(() => {
    if (!safePlace?.id) return;

    setLoadingComments(true);
    const commentsRef = collection(db, "places", safePlace.id, "comments");
    const q = query(commentsRef, orderBy("createdAt", "desc"), fbLimit(20));

    const unsub = onSnapshot(q, (snap) => {
      incMetric("PlaceCard:commentsSnapshot");
      incMetric("PlaceCard:commentsDocs", snap.docs.length, 25);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(rows);
      setLoadingComments(false);
    });

    return () => unsub();
  }, [safePlace?.id]);

  // Real-time listener for place document updates
  useEffect(() => {
    if (!place?.id) return;

    const placeRef = doc(db, "places", place.id);
    const unsub = onSnapshot(placeRef, (snap) => {
      incMetric("PlaceCard:placeSnapshot");
      if (snap.exists()) {
        // Merge listener data with original place to preserve all fields
        setCurrentPlace({
          ...place,
          ...snap.data(),
        });
      }
    });

    return () => unsub();
  }, [place?.id, place]);

  const buildBooleanMapPayload = (stateObj) => {
    const payload = {};
    Object.keys(stateObj).forEach((k) => {
      if (stateObj[k]) payload[k] = true;
    });
    return payload;
  };

  /* ------------------------------------------------------------------ */
  /* DERIVED DATA                                                      */
  /* ------------------------------------------------------------------ */
  // --- CR photo ownership & limits ---

  const crPhotos = Array.isArray(safePlace.photos?.cr)
    ? safePlace.photos.cr
    : [];

  const myCrPhotos = uid
    ? crPhotos.filter(p => p.createdBy === uid)
    : [];

  // Upload permission:
  // - must be allowed to upload at all
  // - Pro/Admin: unlimited
  // - User: max 2 per place
  const canUploadCrPhoto =
    capabilities.canUploadPhotos &&
    (
      capabilities.isAdmin ||
      capabilities.canCreateRoutes || // Pro
      myCrPhotos.length < MAX_USER_PHOTOS_PER_PLACE // User
    );
  const canPreviewSingleRoute = capabilities.canPreviewSingleRoute;
  const distanceMiles = useMemo(() => {
    if (
      !userLocation ||
      typeof safePlace.latitude !== "number" ||
      typeof safePlace.longitude !== "number"
    ) {
      return null;
    }

    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;

    const dLat = toRad(safePlace.latitude - userLocation.latitude);
    const dLng = toRad(safePlace.longitude - userLocation.longitude);
    const lat1 = toRad(userLocation.latitude);
    const lat2 = toRad(safePlace.latitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return ((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 0.62).toFixed(1);
  }, [userLocation, safePlace.latitude, safePlace.longitude]);
  
  const distanceText = useMemo(() => {
    if (hasRoute && routeMeta?.distanceMeters && routeMeta?.durationSeconds) {
      const miles = metersToMiles(routeMeta.distanceMeters);
      const mins = secondsToMinutes(routeMeta.durationSeconds);

      if (miles && mins) {
        return `${miles} miles • ${mins} mins (via route)`;
      }
    }

    if (distanceMiles) {
      return `${distanceMiles} miles • (as the crow flies)`;
    }

    return null;
  }, [hasRoute, routeMeta, distanceMiles]);


  const googleRating =
    googleRatingLive ?? safePlace.googleRating ?? safePlace.rating ?? null;
  const googleRatingCount =
    googleRatingCountLive ??
    safePlace.googleUserRatingsTotal ??
    safePlace.userRatingsTotal ??
    0;
  const crAverageRating = safePlace.crRatings?.average ?? null;
  const crRatingCount = safePlace.crRatings?.count ?? 0;
  
  const rawGooglePhotos = useMemo(() => {
    if (!Array.isArray(safePlace.photos?.google)) return [];
    return safePlace.photos.google
      .map(ref => buildGooglePhotoUrl(ref))
      .filter(Boolean);
  }, [safePlace.photos]);

  const photos = useMemo(() => {
    const crPhotos = Array.isArray(safePlace.photos?.cr)
      ? safePlace.photos.cr
      : [];

    let googlePhotos = [];

    switch (capabilities.googlePhotoAccess) {
      case "full":
        googlePhotos = rawGooglePhotos;
        break;

      case "limited":
        googlePhotos = rawGooglePhotos.slice(0, 2);
        break;

      case "none":
      default:
        googlePhotos = [];
    }

    return [...crPhotos, ...googlePhotos];
  }, [safePlace.photos, rawGooglePhotos, capabilities.googlePhotoAccess]);

  const heroGooglePhoto =
    googlePhotos.length > 0
      ? buildGooglePhotoUrl(googlePhotos[0])
      : null;

  const combinedPhotos = useMemo(() => {
    const list = [];
    if (heroGooglePhoto) {
      list.push(heroGooglePhoto); // string URL
    }
    if (Array.isArray(safePlace.photos.cr)) {
      list.push(...safePlace.photos.cr);
    }
    return list;
  }, [heroGooglePhoto, safePlace.photos.cr]);


  /* ------------------------------------------------------------------ */
  /* HELPERS                                                           */
  /* ------------------------------------------------------------------ */

  function buildGooglePhotoUrl(name, width = 400) {
    return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&key=${GOOGLE_KEY}`;
  }

  function metersToMiles(meters) {
    return meters ? (meters / 1609.34).toFixed(1) : null;
  }

  function secondsToMinutes(seconds) {
    if (!seconds) return null;
    const s = typeof seconds === "string"
      ? parseInt(seconds, 10)
      : seconds;
    return Number.isFinite(s) ? Math.round(s / 60) : null;
  }

  
  const toggleSuitability = async (key) => {
    if (!safePlace?.id) return;

    const next = {
      ...suitabilityState,
      [key]: !suitabilityState[key],
    };

    const payload = buildBooleanMapPayload(next);

    try {
      await updateDoc(doc(db, "places", safePlace.id), {
        suitability: payload,
        updatedAt: serverTimestamp(),
      });

    } catch (err) {
      console.error("[SUITABILITY] save failed", err);
    }

    setSuitabilityState(next);
  };

  const toggleAmenity = async (key) => {
    if (!safePlace?.id) return;

    const next = {
      ...amenitiesState,
      [key]: !amenitiesState[key],
    };

    const payload = Object.entries(next)
      .filter(([, enabled]) => enabled)
      .map(([uiKey]) => AMENITY_KEY_MAP[uiKey])
      .filter(Boolean);

    try {
      await updateDoc(doc(db, "places", safePlace.id), {
        amenities: payload,
        updatedAt: serverTimestamp(),
      });

      console.log("[AMENITIES] saved OK");
    } catch (err) {
      console.error("[AMENITIES] save failed", err);
    }

    setAmenitiesState(next);
  };

  const amenityIcon = (enabled, icon, type = "mc") => {
    const IconSet = type === "ion" ? Ionicons : MaterialCommunityIcons;
    return (
      <IconSet
        name={icon}
        size={20}
        color={theme.colors.text}
        style={[styles.amenityIcon, !enabled && styles.amenityDisabled]}
      />
    );
  };

  function ActionButton({ icon, label, onPress, variant = "secondary", iconOnly = false }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.actionButton,
          variant === "primary"
            ? styles.actionButtonPrimary
            : styles.actionButtonSecondary,
        ]}
      >
        <MaterialCommunityIcons name={icon} size={18} color="#fff" />
        {!iconOnly && <Text style={styles.actionButtonText}>{label}</Text>}
      </TouchableOpacity>
    );
  }

  function formatAddress(address) {
    if (!address) return null;

    // Split on commas and trim
    const parts = address.split(",").map(p => p.trim());

    return {
      line1: parts[0] || null,
      line2: parts.slice(1).join(", ") || null,
    };
  }

  function formatCommentDate(timestamp) {
    if (!timestamp) return "";
    
    try {
      const date = timestamp.toDate?.() || new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch (e) {
      return "";
    }
  }


  /* ------------------------------------------------------------------ */
  /* SAVE PLACE                                                        */
  /* ------------------------------------------------------------------ */

  const handleSavePlace = async () => {
    if (!capabilities.canAddVenue || !uid) {
      setAddError("You need permission and a signed-in account to add places.");
      return;
    }

    try {
      setAddError(null);
      console.log("[SAVE] Starting save with manualName=", manualName, "category=", category);
      const isNewPlace = place.source === "google" || place._temp === true;

      const resolvedAddress =
        safePlace.address ||
        safePlace.formattedAddress ||
        safePlace.vicinity ||
        null;

      const amenities = Object.entries(amenitiesState)
        .filter(([, enabled]) => enabled)
        .map(([uiKey]) => AMENITY_KEY_MAP[uiKey])
        .filter(Boolean);

//      if (amenities.length === 0) {
//        setAddError("Please select at least one amenity before adding this place.");
//        return;
//      }

      const suitability = Object.entries(suitabilityState)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      const name = manualName?.trim() || safePlace.title;
      const latitude = safePlace.latitude;
      const longitude = safePlace.longitude;

      console.log("[SAVE] Validation: name=", name, "lat=", latitude, "lng=", longitude, "category=", category);

      if (typeof latitude !== "number" || typeof longitude !== "number") {
        setAddError("Location data missing for this place.");
        return;
      }

      if (!name || name.trim().length === 0) {
        setAddError("Please enter a place name.");
        return;
      }

      if (!category) {
        setAddError("Please select a category.");
        return;
      }

      const docId = googlePlaceId || safePlace.id;
      console.log("[SAVE] docId=", docId, "googlePlaceId=", googlePlaceId, "safePlace.id=", safePlace.id);
      const placeRef = doc(db, "places", docId);

      const payload = {
        title: name,
        category,
        amenities,
        suitability,
        latitude: safePlace.latitude,
        longitude: safePlace.longitude,
        address: resolvedAddress,
        source: "cr",
        googlePlaceId,
        regularOpeningHours: safePlace.regularOpeningHours || null,
        photos: {
          cr: [],
          google: Array.isArray(place.googlePhotoRefs) && place.googlePhotoRefs.length
            ? place.googlePhotoRefs
            : (Array.isArray(googlePhotos) ? googlePhotos : []),        
        },
        updatedAt: serverTimestamp(),
      };

      if (googlePlaceId) {
        // Extra guard: ensure createdBy is never null
        if (!uid) {
          setAddError("User ID missing. Please sign in again and try adding the place.");
          return;
        }
        // Google places: always CREATE (idempotent)
        console.log("[SAVE] Creating new place with setDoc");
        await setDoc(
          placeRef,
          {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: uid,
          },
          { merge: false } // important
        );
      } else if (isNewPlace) {
        // New temp place: CREATE with setDoc
        console.log("[SAVE] Creating new temp place with setDoc, isNewPlace=", isNewPlace);
        await setDoc(
          placeRef,
          {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: uid,
          },
          { merge: false }
        );
      } else {
        // Existing CR places: UPDATE
        console.log("[SAVE] Updating existing place with updateDoc");
        await updateDoc(placeRef, payload);
      }

      console.log("[SAVE] Success! onPlaceCreated with docId=", docId);
      setAddSuccess(true);
      
      // Call the parent callback with the new place details
      onPlaceCreated?.(name, docId);
      
      // Close the card after a brief delay to show success message
      setTimeout(() => {
        console.log("[SAVE] Closing card after successful save");
        onClose?.();
      }, 1500);
      
    } catch (err) {
      console.error("[SAVE PLACE] failed:", err.message, err);
      setAddError("Failed to save place. Please try again.");
    }
  };

  /* ------------------------------------------------------------------ */
  /* ADD PHOTO                                                         */
  /* ------------------------------------------------------------------ */

  const handleAddPhoto = async () => {
    if (!user || !place?.id) return;
    if (!canUploadCrPhoto) {
      showPostBox({
        type: "info",
        message: "Free users can upload up to 2 photos per place. Upgrade to Pro for unlimited uploads.",
      });
      return;
    }

    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const mediaTypeImages = ImagePicker.MediaType?.Images || ImagePicker.MediaTypeOptions.Images;
    const mediaTypes = ImagePicker.MediaType ? [mediaTypeImages] : mediaTypeImages;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: true,     // 🔥 enable crop UI
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    // 🔑 THIS was missing
    const asset = result.assets?.[0];
    if (!asset?.base64) return;

    const { url } = await uploadImage({
      type: "place",
      placeId: safePlace.id,
      imageBase64: asset.base64,
    });

    const cacheBustedUrl = `${url}?v=${Date.now()}`;

    const newPhoto = {
      url: cacheBustedUrl,
      createdBy: user.uid,
      createdAt: Timestamp.now(),
    };

    await updateDoc(doc(db, "places", safePlace.id), {
      "photos.cr": arrayUnion(newPhoto),
      updatedAt: serverTimestamp(),
    });

    setLocalPlace(prev => ({
      ...prev,
      photos: {
        ...prev.photos,
        cr: [...(prev.photos?.cr || []), newPhoto],
      },
    }));

  };

  async function findGoogleMatch(place) {
    const query = `${place.title} ${place.address || ""}`;

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_KEY,
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 1,
        }),
      }
    );

    const json = await res.json();
    return json.places?.[0] || null;
  }

  const handleSaveRating = async (ratingValue) => {
    if (!capabilities.canRate) return;
    if (!uid || !place?.id || !ratingValue) return;

    const placeRef = doc(db, "places", safePlace.id);

    const existingUsers = safePlace.crRatings?.users || {};
    const nextUsers = {
      ...existingUsers,
      [uid]: {
        rating: ratingValue,
        createdAt: existingUsers[uid]?.createdAt || serverTimestamp(),
        createdBy: uid,
      },
    };

    const ratings = Object.values(nextUsers).map((u) => u.rating);
    const count = ratings.length;
    const average =
      count > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / count) * 10) / 10
        : 0;

    await updateDoc(placeRef, {
      crRatings: {
        users: nextUsers,
        average,
        count,
      },
    });

    // Optimistic UI update
    safePlace.crRatings = { users: nextUsers, average, count };
  };

  const handleResyncWithGoogle = async () => {
    try {
      const match = await findGoogleMatch(safePlace);

      if (!match?.id) {
        Alert.alert("No match found", "Google could not find this place.");
        return;
      }

      await updateDoc(doc(db, "places", safePlace.id), {
        googlePlaceId: match.id,
        googleSyncedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Place linked with Google.");

    } catch (e) {
      console.error("RESYNC FAIL", e);
      Alert.alert("Error", "Failed to sync with Google.");
    }
  };

  const handleRefreshGoogleData = async () => {
    if (!capabilities.isAdmin) {
      Alert.alert("Error", "Only admins can refresh Google data.");
      return;
    }

    if (!safePlace.googlePlaceId) {
      Alert.alert("Error", "This place is not linked to Google Places.");
      return;
    }

    try {
      console.log("[REFRESH] Fetching Google data for:", safePlace.googlePlaceId);
      
      const googleData = await getGoogleDetails({
        placeId: safePlace.googlePlaceId,
      });

      if (!googleData) {
        console.error("[REFRESH] No data returned from getGoogleDetails");
        Alert.alert("Error", "Could not fetch updated data from Google.");
        return;
      }

      console.log("[REFRESH] Got Google data:", googleData);

      // Extract and update relevant fields
      const updatePayload = {
        googleSyncedAt: serverTimestamp(),
      };

      if (googleData.photos?.length > 0) {
        updatePayload["photos.google"] = googleData.photos.map(p => p.photo_reference);
      }

      if (googleData.rating) {
        updatePayload.googleRating = googleData.rating;
      }

      if (googleData.user_ratings_total) {
        updatePayload.googleUserRatingsTotal = googleData.user_ratings_total;
      }

      if (googleData.opening_hours) {
        updatePayload.regularOpeningHours = googleData.opening_hours;
      }

      if (googleData.business_status) {
        updatePayload.businessStatus = googleData.business_status;
      }

      console.log("[REFRESH] Updating with payload:", updatePayload);

      await updateDoc(doc(db, "places", place.id), updatePayload);

      Alert.alert("Success", "Google data updated!");

    } catch (e) {
      console.error("[REFRESH] Error:", e);
      Alert.alert("Error", `Failed to refresh Google data: ${e.message}`);
    }
  };

  const handleDeleteComment = async (commentId, commentCreatedBy) => {
    const canDelete =
      capabilities.isAdmin || (uid && uid === commentCreatedBy);

    if (!canDelete) {
      Alert.alert("Error", "You don't have permission to delete this comment.");
      return;
    }

    try {
      await deleteDoc(
        doc(db, "places", safePlace.id, "comments", commentId)
      );
    } catch (err) {
      console.error("[COMMENTS] failed to delete", err);
      Alert.alert("Error", "Could not delete comment. Try again.");
    }
  };

  /* ------------------------------------------------------------------ */
  /* RENDER                                                            */
  /* ------------------------------------------------------------------ */

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 60}
    >
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      {/* Photos */}
      <View style={styles.photoWrapper}>
        <View style={styles.photoContainer}>
          <FlatList
            horizontal
            data={combinedPhotos}
            keyExtractor={(item, i) =>
              typeof item === "string" ? item : item.url || i.toString()
            }
            snapToInterval={screenWidth}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            style={{ width: screenWidth, height: 180 }}
            onScroll={(e) =>
              setPhotoIndex(
                Math.round(
                  e.nativeEvent.contentOffset.x / screenWidth
                )
              )
            }
            renderItem={({ item }) => {
              const uri = typeof item === "string" ? item : item.url;

              return (
                <Image
                  source={{ uri }}
                  style={styles.photo}
                />              
              );
            }}
          />
          {capabilities.googlePhotoAccess === "limited" &&
          rawGooglePhotos.length > 2 && (
            <Text style={styles.upgradeHint}>
              More photos available with Pro
            </Text>
          )}
          {showNoGooglePhotosMessage && (
            <Text style={styles.noGooglePhotosHint}>
              No Google photos available for this place
            </Text>
          )}

        </View>

        {/* Floating action bar */}
        <View style={styles.photoActionBar}>
          {isCr && currentUid && canUploadCrPhoto && (
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={handleAddPhoto}
            >
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          )}


          {canPreviewSingleRoute && (
            <TouchableOpacity
              /* Route / Clear Route */
              style={styles.photoActionButton}
              onPress={() => {
                if (hasRoute) 
                    onClearRoute?.();
                else 
                    onRoute?.(place);
                    onClose();
              }}
            >
              <MaterialCommunityIcons
                name={hasRoute ? "map-marker-off" : "map-marker-path"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          )}
          {!googlePlaceId && (
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={handleResyncWithGoogle}
            >
              <MaterialCommunityIcons name="sync" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          {capabilities.isAdmin && googlePlaceId && (
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={handleRefreshGoogleData}
            >
              <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
          )}

        </View>
      </View>

      {/* INFO */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >      
        <View style={styles.info}>
          {canAddPlace ? (
            <TextInput
              style={[styles.title, styles.text, { color: theme.colors.text }]}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Place name"
              placeholderTextColor={theme.colors.textMuted}
            />
          ) : (
            <Text style={styles.title}>
              {isManualOnly ? "Save this place" : safePlace.title}
            </Text>
          )}

          {/* Category */}
          <View style={styles.categoryRow}>
            {canAddPlace ? (
              <TouchableOpacity
                style={styles.categoryButton}
                onPress={() => setCategoryModalVisible(true)}
              >
                <Text style={styles.categoryButtonText}>
                  {PLACE_CATEGORIES.find(c => c.key === category)?.label ?? 'Select Category'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.primaryLight} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.categoryText}>
                {PLACE_CATEGORIES.find(c => c.key === safePlace.category)?.label
                  ?? safePlace.category}
              </Text>
            )}
          </View>

          {/* Address */}
          {formattedAddress && (
            <View style={styles.addressContainer}>
              {formattedAddress.line1 && (
                <Text style={styles.addressLine1}>
                  {formattedAddress.line1}
                </Text>
              )}
              {formattedAddress.line2 && (
                <Text style={styles.addressLine2}>
                  {formattedAddress.line2}
                </Text>
              )}
            </View>
          )}
          {distanceMiles && (
            <Text style={styles.subText}>
              {/* {distanceMiles} miles away (straight line distance) */}
              {distanceText}
            </Text>
          )}

          {/* Opening Hours (Google only) */}
          <TouchableOpacity
            onPress={() => setHoursExpanded(v => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <Text style={{ color: openingStatus.color, fontWeight: "600" }}>
              🕒 {openingStatus.label}
            </Text>

            <MaterialCommunityIcons
              name={hoursExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color="#888"
            />
          </TouchableOpacity>
          {hoursExpanded && (
            <View style={{ marginTop: 8 }}>
              {weekList.map((d, i) => (
                <Text
                  key={i}
                  style={{
                    color: "#666",
                    fontSize: 13,
                    marginVertical: 2,
                  }}
                >
                  {d}
                </Text>
              ))}
            </View>
          )}

          {/* Ratings */}
          <View style={styles.ratingsSection}>
            <Text style={styles.crLabel}>Ratings</Text>

            {/* Google rating (always allowed) */}
            {googleRating ? (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingValue}>
                  ★ {googleRating.toFixed(1)}
                </Text>
                <Text style={styles.ratingMeta}>
                  ({googleRatingCount}) G
                </Text>
              </View>
            ) : null}
          </View>

          {/* CR rating: single 5-star row (overall + user overlay) */}
          {isRealCr && (
            <View style={[styles.ratingRow, { marginTop: 6 }]}>
              <View style={styles.rateRow}>
                {(() => {
                  const overallStars =
                    crAverageRating && crRatingCount > 0 ? Math.round(crAverageRating) : 0;

                  // Use selectedRating for immediate UI feedback; fall back to stored userCrRating
                  const userStars = canRate ? (selectedRating || userCrRating || 0) : 0;

                  return [1, 2, 3, 4, 5].map((v) => {
                    const isUserFilled = userStars >= v;
                    const isOverallFilled = overallStars >= v;

                    const name = isUserFilled || isOverallFilled ? "star" : "star-outline";
                    const color = isUserFilled
                      ? theme.colors.primaryLight
                      : theme.colors.primaryMid;

                    const Star = (
                      <MaterialCommunityIcons
                        name={name}
                        size={22}
                        color={color}
                        style={{ marginRight: 2 }}
                      />
                    );

                    // Only tappable for users who can rate
                    return canRate ? (
                      <TouchableOpacity
                        key={v}
                        style={styles.starButton}
                        onPress={() => {
                          setSelectedRating(v);
                          handleSaveRating(v);
                        }}
                      >
                        {Star}
                      </TouchableOpacity>
                    ) : (
                      <View key={v} style={{ paddingHorizontal: 2 }}>
                        {Star}
                      </View>
                    );
                  });
                })()}
              </View>

              <Text style={[styles.ratingMeta, { marginLeft: 8 }]}>
                ({crRatingCount || 0})
              </Text>
            </View>
          )}

          {safePlace.source === "google" && (
            <Text style={styles.helperText}>
              Select suitability & amenities before saving
            </Text>
          )}


          {/* Suitability */}
          {!isNewPlace && (
            <View
              style={[
                styles.editableSection,
                safePlace.source === "google" && styles.editableHighlight,
              ]}
            >
              <Text style={styles.crLabel}>Meet-ups / Suitability</Text>
              <View style={styles.amenitiesRow}>
                {Object.keys(defaultSuitability).map((key) => (
                  <TouchableOpacity
                    key={key}
                    disabled={!capabilities.canUpdatePlaces}
                    onPress={() => toggleSuitability(key)}
                    style={{
                      opacity:
                        !capabilities.canCreateRoutes ||
                        (!capabilities.isAdmin && suitabilityState[key])
                          ? 0.6
                          : 1
                    }}
                  >
                    {amenityIcon(
                      suitabilityState[key],
                      key === "bikers"
                        ? "motorbike"
                        : key === "scooters"
                        ? "moped"
                        : key === "cyclists"
                        ? "bike"
                        : key === "walkers"
                        ? "walk"
                        : key === "cars"
                        ? "car"
                        : "car-electric"
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            
              {/* Amenities */}
              <Text style={styles.crLabel}>Amenities</Text>
              <View style={styles.amenitiesRow}>
                {Object.keys(defaultAmenities).map((key) => (
                  <TouchableOpacity
                    key={key}
                    disabled={!capabilities.canUpdatePlaces}
                    onPress={() => toggleAmenity(key)}
                    style={{
                      opacity:
                        !capabilities.canCreateRoutes ||
                        (!capabilities.isAdmin && amenitiesState[key])
                          ? 0.6
                          : 1
                    }}
                  >
                    {amenityIcon(
                      amenitiesState[key],
                      key === "parking"
                        ? "parking"
                        : key === "evCharger"
                        ? "ev-plug-ccs2"
                        : key === "toilets"
                        ? "toilet"
                        : key === "petFriendly"
                        ? "dog-side"
                        : key === "disabledAccess"
                        ? "wheelchair-accessibility"
                        : "table-picnic"
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          {addError && (
            <View style={styles.savedHint}>
              <Text style={{ color: theme.colors.danger }}>
                {addError}
              </Text>
            </View>
          )}

          {addSuccess && (
            <View style={styles.savedHint}>
              <Text style={{ color: theme.colors.accentMid }}>
                Place saved successfully!
              </Text>
            </View>
          )}
        
          {canAddPlace && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSavePlace}
            >
              <Text style={styles.primaryButtonText}>
                  Add this place
                </Text>
              </TouchableOpacity>
            )}

          {/* Comments */}
          <View
            style={[
              styles.editableSection,
            ]}
          >
            <View style={styles.commentsHeader}>
              <Text style={styles.crLabel}>Comments</Text>
              {comments.length > 1 && (
                <TouchableOpacity
                  onPress={() => setCommentsExpanded(!commentsExpanded)}
                >
                  <Text style={styles.expandButtonText}>
                    {commentsExpanded
                      ? "Collapse"
                      : `View all (${comments.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingComments ? (
              <Text style={styles.commentMeta}>Loading comments...</Text>
            ) : comments.length === 0 ? (
              <Text style={styles.commentMeta}>No comments yet</Text>
            ) : (
              (() => {
                const visibleComments = commentsExpanded
                  ? comments
                  : comments.slice(0, 1);

                return visibleComments.map((c) => {
                  const canDeleteComment =
                    capabilities.isAdmin || (uid && uid === c.createdBy);

                  return (
                    <View key={c.id} style={styles.commentRow}>
                      <View style={styles.commentHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commentAuthor}>
                            {c.displayName || "Anonymous"}
                          </Text>
                          <Text style={styles.commentDate}>
                            {formatCommentDate(c.createdAt)}
                          </Text>
                        </View>
                        {canDeleteComment && (
                          <TouchableOpacity
                            onPress={() =>
                              handleDeleteComment(c.id, c.createdBy)
                            }
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={16}
                              color={theme.colors.textMuted}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.commentText}>{c.text}</Text>
                    </View>
                  );
                });
              })()
            )}

            {capabilities.canComment && uid && (
              <View style={styles.commentInputRow}>
                <TextInput
                  ref={commentInputRef}
                  style={styles.commentInput}
                  placeholder="Add a comment"
                  placeholderTextColor={theme.colors.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                  onFocus={() => {
                    // Scroll to bottom after keyboard opens
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                />
                <TouchableOpacity
                  style={[
                    styles.commentButton,
                    !commentText.trim() && styles.commentButtonDisabled,
                  ]}
                  onPress={async () => {
                    const text = commentText.trim();
                    if (!text) return;

                    const displayName =
                      auth?.profile?.displayName ||
                      user?.email ||
                      "Anonymous";

                    try {
                      await addDoc(
                        collection(db, "places", safePlace.id, "comments"),
                        {
                          text,
                          createdAt: serverTimestamp(),
                          createdBy: uid,
                          displayName,
                        }
                      );

                      setCommentText("");
                    } catch (err) {
                      console.error("[COMMENTS] failed to post", err);
                      Alert.alert("Error", "Could not post comment. Try again.");
                    }
                  }}
                  disabled={!commentText.trim()}
                >
                  <Text style={styles.commentButtonText}>Post</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Category Selection Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView style={styles.categoryList}>
              {PLACE_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[
                    styles.categoryItem,
                    category === c.key && styles.categoryItemSelected
                  ]}
                  onPress={() => {
                    setCategory(c.key);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.categoryItemText,
                    category === c.key && styles.categoryItemTextSelected
                  ]}>
                    {c.label}
                  </Text>
                  {category === c.key && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={theme.colors.accentDark}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES                                                             */
/* ------------------------------------------------------------------ */

function createStyles(theme) {
  return {
    container: {
      position: "absolute",
      bottom: 100,
      left: 10,
      right: 10,
      maxHeight: "70%",
      backgroundColor: theme.colors.primaryDark,
      borderRadius: 16,
      overflow: "hidden",
      elevation: 10,
      zIndex: 3000,
      flex: 1,
    },
    closeButton: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 16,
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    photoContainer: { height: 150 },
    photo: {
      width: screenWidth,      
      backgroundColor: "#000", // or theme dark
      resizeMode: "contain"
    },
    info: { padding: 12 },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.accentMid,
    },
    subTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accentDark,
    },
    text: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primaryLight,
    },
    subText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primaryLight,
    },
    crLabel: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.accentDark,
    },
    amenitiesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
    },
    amenityIcon: {
      marginRight: 14,
      marginBottom: 6,
    },
    amenityDisabled: { opacity: 0.3 },
    distance: {
      marginTop: 4,
      color: theme.colors.text,
    },
    primaryButton: {
      marginTop: 16,
      backgroundColor: theme.colors.accentDark,
      paddingVertical: 10,
      borderRadius: 20,
      alignItems: "center",
    },
    primaryButtonText: {
      color: theme.colors.primaryDark,
      fontWeight: "600",
    },
    addPhotoButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 8,
      backgroundColor: theme.colors.accentMid,
    },
    addPhotoText: {
      marginLeft: 6,
      fontWeight: "600",
    },

    actionsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
    },

    primaryAction: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },

    primaryActionText: {
      color: theme.colors.onPrimary || "#fff",
      fontWeight: "600",
    },

    secondaryAction: {
      flex: 1,
      backgroundColor: theme.colors.accentDark,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },

    secondaryActionText: {
      color: theme.colors.primaryDark,
      fontWeight: "500",
    },

    ratingsSection: {
      marginTop: 12,
    },

    commentsSection: {
      marginTop: 16,
    },

    commentsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },

    expandButtonText: {
      fontSize: 12,
      color: theme.colors.primaryLight,
      fontWeight: "500",
    },

    commentRow: {
      marginTop: 8,
      backgroundColor: theme.colors.primaryMid,
      padding: 10,
      borderRadius: 8,
    },

    commentHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 6,
    },

    commentAuthor: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.accentDark,
      flex: 1,
    },

    commentDate: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },

    commentText: {
      marginTop: 4,
      fontSize: 13,
      color: theme.colors.text,
    },

    commentMeta: {
      marginTop: 6,
      fontSize: 13,
      color: theme.colors.textMuted,
    },

    commentInputRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 12,
    },

    commentInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.primaryMid,
      color: theme.colors.text,
      textAlignVertical: "top",
    },

    commentButton: {
      marginLeft: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.accentDark,
      alignSelf: "flex-end",
    },

    commentButtonDisabled: {
      opacity: 0.5,
    },

    commentButtonText: {
      color: theme.colors.primaryDark,
      fontWeight: "700",
    },

    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },

    ratingValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accentDark,
      marginRight: 6,
    },

    ratingMeta: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },

    scroll: {
      flexGrow: 0,
    },

    scrollContent: {
      paddingBottom: 200,
    },
  
    rateRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },

    starButton: {
      paddingHorizontal: 2,
    },

    star: {
      fontSize: 22,
      color: theme.colors.textMuted,
    },

    starActive: {
      color: theme.colors.accentDark,
    },

    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
    },

    actionButtonPrimary: {
      backgroundColor: theme.colors.primary, // TEMP: primary blue
    },

    actionButtonSecondary: {
      backgroundColor: theme.colors.accentMid, // TEMP: accentDark
    },

    actionButtonText: {
      color: "#f9fafb",
      fontSize: 14,
      fontWeight: "600",
    },

    photoWrapper: {
      position: "relative",
    },

    photoActionBar: {
      position: "absolute",
      right: 12,
      bottom: 12,
      flexDirection: "row",
      gap: 8,
    },

    photoActionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.accentDark, // accentDark
      justifyContent: "center",
      alignItems: "center",
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },

    primaryAction: {
      backgroundColor: theme.colors.primary, // primary blue
    },

    savedHint: {
      marginTop: 8,
      fontSize: 13,
      color: theme.colors.accentMid,
      textAlign: "center",
    },

    categoryRow: {
      marginTop: 6,
      marginBottom: 4,
    },

    categoryText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },

    categoryPicker: {
      height: 55,
      color: theme.colors.primaryLight,
      backgroundColor: theme.colors.primaryDark,
    },
    
    editableHighlight: {
      backgroundColor: "rgba(255, 200, 0, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(255, 200, 0, 0.4)",
      borderRadius: 8,
      padding: 8,
    },

    addressContainer: {
      marginTop: 4,
      marginBottom: 8,
    },
    addressLine1: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    addressLine2: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },

    categoryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.primaryMid,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.primaryLight,
    },
    categoryButtonText: {
      fontSize: 14,
      color: theme.colors.primaryLight,
      flex: 1,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.primaryDark,
      borderRadius: 16,
      padding: 20,
      width: '100%',
      maxWidth: 350,
      maxHeight: '70%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    categoryList: {
      maxHeight: 400,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: theme.colors.primaryMid,
    },
    categoryItemSelected: {
      backgroundColor: theme.colors.accentLight,
    },
    categoryItemText: {
      fontSize: 15,
      color: theme.colors.text,
    },
    categoryItemTextSelected: {
      fontWeight: '600',
      color: theme.colors.accentDark,
    },
  };
}

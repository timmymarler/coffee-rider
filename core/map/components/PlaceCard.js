import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { GOOGLE_PHOTO_LIMITS, PHOTO_POLICY } from "@core/config/photoPolicy";
import { buildGooglePhotoUrl } from "@core/google/buildGooglePhotoUrl";
import { getCapabilities } from "@core/roles/getCapabilities";
import { uploadImage } from "@core/utils/uploadImage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import theme from "@themes";
import * as ImagePicker from "expo-image-picker";
import {
  arrayUnion,
  doc, serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable, ScrollView, Text,
  TouchableOpacity,
  View
} from "react-native";
import { RIDER_CATEGORIES } from "../../config/categories/rider";

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const PLACE_CATEGORIES = RIDER_CATEGORIES;
const screenWidth = Dimensions.get("window").width;
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
  motorcycleParking: false,
  evCharger: false,
  toilets: false,
  petFriendly: false,
  disabledAccess: false,
  outdoorSeating: false,
};

// UI key → Firestore key
const AMENITY_KEY_MAP = {
  parking: "parking",
  motorcycleParking: "motorcycle_parking",
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
  routeMeta=null,
  onPlaceCreated,
  onClearRoute = null,
  onRoute,
  onNavigate,
}) {
  const safePlace = {
    ...place,

    photos: place.photos ?? { cr: [], google: [] },
    amenities: Array.isArray(place.amenities) ? place.amenities : [],
    suitability: Array.isArray(place.suitability) ? place.suitability : [],
    crRatings: place.crRatings ?? {
      average: null,
      count: 0,
      users: {},
    },
    latitude:
      typeof place.latitude === "number"
        ? place.latitude
        : place.location?.latitude ?? null,
    longitude:
      typeof place.longitude === "number"
        ? place.longitude
        : place.location?.longitude ?? null,
    address:
      place.address ||
      place.formattedAddress ||
      place.vicinity ||
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
    (safePlace.source === "google" && safePlace.id) ||
    null;

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
    (safePlace.source === "google" || safePlace._temp === true);

  const isCrPlace = safePlace.source === "cr";  
  //const isEditable = safePlace.source === "google" || safePlace._temp === true ; // add flow only (for now)

  useEffect(() => {
    setSelectedRating(userCrRating);
  }, [userCrRating, place?.id]);

  /* ------------------------------------------------------------------ */
  /* LOCAL STATE                                                        */
  /* ------------------------------------------------------------------ */

  const [manualName, setManualName] = useState(
    isGoogleNew ? safePlace.title ?? "" : ""
  );

  const [manualCategory, setManualCategory] = useState(
    isGoogleNew ? safePlace.category ?? null : null
  );
  const formattedAddress = useMemo(
    () => formatAddress(place.address),
    [place.address]
  );

  const [commentText, setCommentText] = useState("");
  const [ratingInput, setRatingInput] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [localPlace, setLocalPlace] = useState(place);
  const [category, setCategory] = useState("cafe");
  const [addError, setAddError] = useState(null);

  const [suitabilityState, setSuitabilityState] = useState(() => {
    const state = { ...defaultSuitability };

    if (Array.isArray(safePlace.suitability)) {
      safePlace.suitability.forEach((key) => {
        if (key in state) state[key] = true;
      });
    }

    return state;
  });

  const [amenitiesState, setAmenitiesState] = useState(() => {
    const state = { ...defaultAmenities };

    if (Array.isArray(place?.amenities)) {
      safePlace.amenities.forEach((storedKey) => {
        const uiKey = Object.keys(AMENITY_KEY_MAP).find(
          (k) => AMENITY_KEY_MAP[k] === storedKey
        );
        if (uiKey) state[uiKey] = true;
      });
    }

    return state;
  });

  /* ------------------------------------------------------------------ */
  /* DERIVED DATA                                                      */
  /* ------------------------------------------------------------------ */

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


  const googleRating = safePlace.googleRating ?? safePlace.rating ?? null;
  const googleRatingCount = safePlace.googleUserRatingsTotal ?? safePlace.userRatingsTotal ?? 0;
  const crAverageRating = safePlace.crRatings?.average ?? null;
  const crRatingCount = safePlace.crRatings?.count ?? 0;

  const photos = useMemo(() => {
    const policy = PHOTO_POLICY[role] || PHOTO_POLICY.guest;

    const crPhotos = Array.isArray(safePlace.photos?.cr)
      ? safePlace.photos.cr
      : [];

    const googlePhotos = Array.isArray(safePlace.photos?.google)
      ? safePlace.photos.google
          .map(buildGooglePhotoUrl)
          .filter(Boolean)
          .slice(0, GOOGLE_PHOTO_LIMITS.maxPhotosPerPlace)
      : [];

    if (!policy.viewCrPhotos && !policy.viewGooglePhotos) {
      return [];
    }

    return [
      ...(policy.viewCrPhotos ? crPhotos : []),
      ...(policy.viewGooglePhotos ? googlePhotos : []),
    ];
  }, [safePlace.photos, role]);

  const photoPolicy = PHOTO_POLICY[role] || PHOTO_POLICY.guest;
  const crPhotoCount = Array.isArray(safePlace.photos) ? safePlace.photos.length : 0;
  const canUploadPhoto = photoPolicy.maxCrUploads > crPhotoCount;

  /* ------------------------------------------------------------------ */
  /* HELPERS                                                           */
  /* ------------------------------------------------------------------ */


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

  const toggleSuitability = (key) => {
    setSuitabilityState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAmenity = (key) => {
    setAmenitiesState((prev) => ({ ...prev, [key]: !prev[key] }));
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

  function defaultAmenitiesFromPlace(place) {
    const base = { ...defaultAmenities };

    if (Array.isArray(place.amenities)) {
      place.amenities.forEach((a) => {
        if (a in base) base[a] = true;
      });
    }

    return base;
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


  /* ------------------------------------------------------------------ */
  /* SAVE PLACE                                                        */
  /* ------------------------------------------------------------------ */

  const handleSavePlace = async () => {

    try {
      setAddError(null);
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

      if (amenities.length === 0) {
        setAddError("Please select at least one amenity before adding this place.");
        return;
      }

      const suitability = Object.entries(suitabilityState)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      const name = manualName?.trim() || safePlace.title;
      const latitude = safePlace.latitude;
      const longitude = safePlace.longitude;

      if (typeof latitude !== "number" || typeof longitude !== "number") {
        setAddError("Location data missing for this place.");
        return;
      }

      const docId = googlePlaceId || safePlace.id;
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
        googlePlaceId,            // important
        updatedAt: serverTimestamp(),
      };

      if (googlePlaceId) {
        // Google places: always CREATE (idempotent)
        await setDoc(
          placeRef,
          {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: uid,
          },
          { merge: false } // important
        );
      } else {
        // Existing CR places
        await updateDoc(placeRef, payload);
      }

      onPlaceCreated?.(docId);
      
    } catch (err) {
      console.error("[SAVE PLACE] failed", err);
      setAddError("Failed to save place. Please try again.");
    }
  };

  /* ------------------------------------------------------------------ */
  /* ADD PHOTO                                                         */
  /* ------------------------------------------------------------------ */

  const handleAddPhoto = async () => {
    if (!user || !place?.id) return;

    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,     // 🔥 enable crop UI
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    // 🔑 THIS was missing
    const asset = result.assets?.[0];
    if (!asset?.base64) return;

    const { url } = await uploadImage({
      user,
      type: "place",
      placeId: safePlace.id,
      imageBase64: asset.base64,
    });

    const cacheBustedUrl = `${url}?v=${Date.now()}`;

    await updateDoc(doc(db, "places", safePlace.id), {
      "photos.cr": arrayUnion(cacheBustedUrl),
    });

    setLocalPlace(prev => ({
      ...prev,
      photos: {
        ...prev.photos,
        cr: [...(prev.photos?.cr || []), cacheBustedUrl],
      },
    }));

  };

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

  /* ------------------------------------------------------------------ */
  /* RENDER                                                            */
  /* ------------------------------------------------------------------ */

  return (
    
    <View style={styles.container}>
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      {/* Photos */}
      <View style={styles.photoWrapper}>
        <View style={styles.photoContainer}>
          <ScrollView
            horizontal
            snapToInterval={screenWidth}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={{ width: screenWidth, height: 180 }}
            onScroll={(e) =>
              setPhotoIndex(
                Math.round(
                  e.nativeEvent.contentOffset.x / screenWidth
                )
              )
            }
          >
            {photos.map((p, i) => (
              <Image key={i} source={{ uri: p }} style={styles.photo} />
            ))}
          </ScrollView>
        </View>

        {/* Floating action bar */}
        <View style={styles.photoActionBar}>
          {isCr && currentUid && canUploadPhoto && (
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={handleAddPhoto}
            >
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {canNavigate && (
            <TouchableOpacity
              /* Navigate */
              style={[styles.photoActionButton, styles.primaryAction]}
                onPress={() => onNavigate(place)}
            >
              <MaterialCommunityIcons
                name="navigation-variant"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            /* Route / Clear Route */
            style={styles.photoActionButton}
            onPress={() => {
              if (hasRoute) 
                  onClearRoute?.();
              else 
                  onRoute?.(place);
            }}
          >
            <MaterialCommunityIcons
              name={hasRoute ? "map-marker-off" : "map-marker-path"}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* INFO */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >      
        <View style={styles.info}>
          <Text style={styles.title}>
            {isManualOnly ? "Save this place" : safePlace.title}
          </Text>

          {/* Category */}
          <View style={styles.categoryRow}>
            {canAddPlace ? (
              <Picker
                selectedValue={category}
                onValueChange={(value) => setCategory(value)}
                style={styles.categoryPicker}
                dropdownIconColor={theme.colors.primaryLight}
              >
                {PLACE_CATEGORIES.map((c) => (
                  <Picker.Item
                    key={c.key}
                    label={c.label}
                    value={c.key}
                    color={theme.colors.primaryLight}
                  />
                ))}
              </Picker>
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
          {safePlace.regularOpeningHours?.weekdayDescriptions?.length ? (
            <View style={styles.openingHours}>
              <Text style={styles.crLabel}>Opening Hours</Text>
              {safePlace.regularOpeningHours.weekdayDescriptions.map((line) => (
                <Text key={line} style={styles.subText}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}

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
          <View
            style={[
              styles.editableSection,
              safePlace.source === "google" && styles.editableHighlight,
            ]}
          >
            <Text style={styles.crLabel}>Suitability</Text>
            <View style={styles.amenitiesRow}>
              {Object.keys(defaultSuitability).map((key) => (
                <TouchableOpacity
                  key={key}
                  disabled={!canAddPlace}
                  onPress={() => canAddPlace && toggleSuitability(key)}
                  style={{ opacity: canAddPlace ? 1 : 0.5 }}
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
                  disabled={!canAddPlace}
                  onPress={() => canAddPlace && toggleAmenity(key)}
                  style={{ opacity: canAddPlace ? 1 : 0.5 }}
                >
                  {amenityIcon(
                    amenitiesState[key],
                    key === "parking"
                      ? "parking"
                      : key === "motorcycleParking"
                      ? "motorbike"
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
            {addError && (
              <View style={styles.savedHint}>
                <Text style={{ color: theme.colors.accentMid }}>
                  {addError}
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
        </View>
      </ScrollView>
    </View>
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
      maxHeight: "65%",
      backgroundColor: theme.colors.primaryDark,
      borderRadius: 16,
      overflow: "hidden",
      elevation: 10,
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
      width: screenWidth - 32,
      height: 180,
      marginHorizontal: 16,
      borderRadius: 8,
      resizeMode: "cover",
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
      paddingBottom: 16,
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
  };
}

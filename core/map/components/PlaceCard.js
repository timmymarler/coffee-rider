import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { getCapabilities } from "@core/roles/getCapabilities";
import { uploadImage } from "@core/utils/uploadImage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import theme from "@themes";
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  arrayUnion,
  collection, doc, serverTimestamp, updateDoc
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
  const isGoogleNew = place?.source === "google-new";
  const isCr = place?.source === "cr";
  const isRealCr = place.source === "cr" && !place._temp;
  const uid = user?.uid;
  const userCrRating =
    uid && place.crRatings?.users?.[uid]?.rating
      ? place.crRatings.users[uid].rating
      : 0;
  const [selectedRating, setSelectedRating] = useState(userCrRating);
  const canAddPlace = place.source !== "cr" && !place._justAdded;
  const isCrPlace = place.source === "cr";
  const isEditable = place.source !== "cr"; // add flow only (for now)


  useEffect(() => {
    setSelectedRating(userCrRating);
  }, [userCrRating, place?.id]);

  /* ------------------------------------------------------------------ */
  /* LOCAL STATE                                                        */
  /* ------------------------------------------------------------------ */

  const [manualName, setManualName] = useState(
    isGoogleNew ? place.title ?? "" : ""
  );

  const [manualCategory, setManualCategory] = useState(
    isGoogleNew ? place.category ?? null : null
  );

  const [commentText, setCommentText] = useState("");
  const [ratingInput, setRatingInput] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [localPlace, setLocalPlace] = useState(place);
  const [category, setCategory] = useState("cafe");
  
  const [suitabilityState, setSuitabilityState] = useState(() => ({
    ...defaultSuitability,
    ...(place.suitability || {}),
  }));

  const [amenitiesState, setAmenitiesState] = useState(() => {
    const state = { ...defaultAmenities };

    if (Array.isArray(place?.amenities)) {
      place.amenities.forEach((storedKey) => {
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
    if (!userLocation || !place.latitude || !place.longitude) return null;

    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;

    const dLat = toRad(place.latitude - userLocation.latitude);
    const dLng = toRad(place.longitude - userLocation.longitude);
    const lat1 = toRad(userLocation.latitude);
    const lat2 = toRad(place.latitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return ((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))*0.62).toFixed(1);
  }, [userLocation, place]);
  
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

  const photos = useMemo(() => {
    return [
      ...(Array.isArray(place.photos) ? place.photos : []),
      ...(Array.isArray(place.googlePhotoUrls)
        ? place.googlePhotoUrls
        : []),
    ].filter(Boolean);
  }, [place]);

  const googleRating =
    place.googleRating ?? place.rating ?? null;
  const googleRatingCount =
    place.googleUserRatingsTotal ?? place.userRatingsTotal ?? 0;
  const crAverageRating = place.crRatings?.average ?? null;
  const crRatingCount = place.crRatings?.count ?? 0;

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

  /* ------------------------------------------------------------------ */
  /* SAVE PLACE                                                        */
  /* ------------------------------------------------------------------ */

  const handleSavePlace = async () => {

    const selectedAmenities = Object.values(amenitiesState).some(Boolean);
    if (!selectedAmenities) {
      console.log("[SAVE PLACE] no amenities selected");
      return;
    }

    const name = manualName.trim() || place.title || "Untitled place";
    const { latitude, longitude } = place;
    if (!latitude || !longitude) return;

    const amenities = Object.entries(amenitiesState)
      .filter(([, enabled]) => enabled)
      .map(([uiKey]) => AMENITY_KEY_MAP[uiKey]);

    try {
      const placeRef = await addDoc(collection(db, "places"), {
        name,
        category: category || "cafe",
        location: { latitude, longitude },
        suitability: suitabilityState,
        amenities,
        googlePhotoUrls: place.googlePhotoUrls || [],
        googleRating: place.rating ?? null,
        googleUserRatingsTotal: place.userRatingsTotal ?? 0,
        createdAt: serverTimestamp(),
        createdBy: currentUid,
        source: "cr",
        crRatings:
          ratingInput > 0
            ? {
                average: ratingInput,
                count: 1,
                users: {
                  [currentUid]: {
                    rating: ratingInput,
                    createdAt: serverTimestamp(),
                    createdBy: currentUid,
                  },
                },
              }
            : { average: null, count: 0, users: {} },
      });

      // 🔔 notify parent (THIS is what triggers postbox)
      onPlaceCreated?.(name, placeRef.id);

    } catch (err) {
      console.log("[SAVE PLACE] failed", err);
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
      placeId: place.id,
      imageBase64: asset.base64,
    });

    const cacheBustedUrl = `${url}?v=${Date.now()}`;

    await updateDoc(doc(db, "places", place.id), {
      photos: arrayUnion(cacheBustedUrl),
    });

    setLocalPlace(prev => ({
      ...prev,
      photos: [...(prev.photos || []), cacheBustedUrl],
    }));

  };

  const handleSaveRating = async (ratingValue) => {
    if (!capabilities.canRate) return;
    if (!uid || !place?.id || !ratingValue) return;

    const placeRef = doc(db, "places", place.id);

    const existingUsers = place.crRatings?.users || {};
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
    place.crRatings = { users: nextUsers, average, count };
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
            pagingEnabled
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
          {isCr && currentUid && (
            <TouchableOpacity
              /* Add photo */
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
              if (hasRoute) onClearRoute?.();
              else onRoute?.(place);
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
            {isManualOnly ? "Save this place" : place.title}
          </Text>

          {/* Category */}
          <View style={styles.categoryRow}>
            {isEditable ? (
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
                {PLACE_CATEGORIES.find(c => c.key === place.category)?.label
                  ?? place.category}
              </Text>
            )}
          </View>

          {/* Address */}
          {(place.address || place.formattedAddress) ? (
            <Text style={styles.subText}>
              {place.address || place.formattedAddress} 
            </Text>
          ) : null}
          {distanceMiles && (
            <Text style={styles.subText}>
              {/* {distanceMiles} miles away (straight line distance) */}
              {distanceText}
            </Text>
          )}
          {/* Opening Hours (Google only) */}
          {place.regularOpeningHours?.weekdayDescriptions?.length ? (
            <View style={styles.openingHours}>
              <Text style={styles.crLabel}>Opening Hours</Text>
              {place.regularOpeningHours.weekdayDescriptions.map((line) => (
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

          {/* Suitability */}
          <Text style={styles.crLabel}>Suitability</Text>
          <View style={styles.amenitiesRow}>
            {Object.keys(defaultSuitability).map((key) => (
              <TouchableOpacity
                key={key}
                disabled={!isEditable}
                onPress={() => isEditable && toggleSuitability(key)}
                style={{ opacity: isEditable ? 1 : 0.5 }}
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
                disabled={!isEditable}
                onPress={() => isEditable && toggleAmenity(key)}
                style={{ opacity: isEditable ? 1 : 0.5 }}
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
    photo: { width: screenWidth, height: 150 },
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
      color: theme.colors.primaryLight,
    },

    categoryPicker: {
      height: 55,
      color: theme.colors.primaryLight,
      backgroundColor: theme.colors.primaryDark,
    },
    
  };
}

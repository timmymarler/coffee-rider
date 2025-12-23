import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { uploadImage } from "@core/utils/uploadImage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  onNavigate,
  onRoute,
}) {

  const styles = createStyles(theme);
  const { user, profile, loading, logout, refreshProfile, capabilities } = useContext(AuthContext);
  const currentUser = user || null;
  const currentUid = currentUser?.uid || null;

  const isManualOnly = place?.source === "manual";
  const isGoogle = place?.source === "google";
  const isGoogleNew = place?.source === "google-new";
  const isCr = place?.source === "cr";

  const isCreateMode = isManualOnly || isGoogleNew;

  const uid = user?.uid;

  const userCrRating =
    uid && place.crRatings?.users?.[uid]?.rating
      ? place.crRatings.users[uid].rating
      : 0;

  const [selectedRating, setSelectedRating] = useState(userCrRating);
  const [justSaved, setJustSaved] = useState(false);

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
      return `${distanceMiles} miles away (as the crow flies)`;
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
    if (!isCreateMode) return;
    setSuitabilityState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAmenity = (key) => {
    if (!isCreateMode) return;
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

  /* ------------------------------------------------------------------ */
  /* SAVE PLACE                                                        */
  /* ------------------------------------------------------------------ */

  const handleSavePlace = async () => {
    if (!isCreateMode || !currentUid) return;

    const name = manualName.trim() || place.title || "Untitled place";
    const { latitude, longitude } = place;

    if (!latitude || !longitude) return;

    const amenities = Object.entries(amenitiesState)
      .filter(([, enabled]) => enabled)
      .map(([uiKey]) => AMENITY_KEY_MAP[uiKey]);

    try {
      const placeRef = await addDoc(collection(db, "places"), {
        name,
        category: manualCategory ?? place.category ?? null,
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

      onPlaceCreated?.({
        id: placeRef.id,
        source: "cr",
        title: name,
        latitude,
        longitude,
        category: manualCategory ?? place.category ?? null,
        suitability: suitabilityState,
        amenities,
        googlePhotoUrls: place.googlePhotoUrls || [],
      });

      setJustSaved(true);

      setTimeout(() => {
        setJustSaved(false);
      }, 1200);

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

  const handleSaveRating = async () => {
    if (!capabilities.canRate) return;
    if (!uid || !place?.id || !selectedRating) return;

    const placeRef = doc(db, "places", place.id);

    // Clone existing users map (or start fresh)
    const existingUsers = place.crRatings?.users || {};
    const nextUsers = {
      ...existingUsers,
      [uid]: {
        rating: selectedRating,
        createdAt: existingUsers[uid]?.createdAt || serverTimestamp(),
        createdBy: uid,
      },
    };

    // Recompute aggregates
    const ratings = Object.values(nextUsers).map((u) => u.rating);
    const count = ratings.length;
    const average =
      count > 0
        ? Math.round(
            (ratings.reduce((sum, r) => sum + r, 0) / count) * 10
          ) / 10
        : 0;

    await updateDoc(placeRef, {
      crRatings: {
        users: nextUsers,
        average,
        count,
      },
    });

    // Optimistic UI update
    place.crRatings = {
      users: nextUsers,
      average,
      count,
    };
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

      {isCr && currentUid && (
        <TouchableOpacity
          style={styles.addPhotoButton}
          onPress={handleAddPhoto}
        >
          <Ionicons name="camera" size={18} />
          <Text style={styles.addPhotoText}>Add Photo</Text>
        </TouchableOpacity>
      )}

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
          {place.category ? (
            <Text style={styles.ratingMeta}>
              {place.category.charAt(0).toUpperCase() + place.category.slice(1)}
            </Text>
          ) : null}
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

            {/* Google rating */}
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

            {/* CR rating */}
            {crAverageRating !== null ? (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingValue}>
                  ★ {crAverageRating.toFixed(1)}
                </Text>
                <Text style={styles.ratingMeta}>
                  ({crRatingCount})
                </Text>
              </View>
            ) : null}
          </View>
          
          {/* Add user rating */}
          {capabilities.canRate ? (
            <View style={styles.rateRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    setSelectedRating(value);
                    handleSaveRating(value);
                  }}
                  style={styles.starButton}
                >
                  <Text
                    style={[
                      styles.star,
                      value <= selectedRating && styles.starActive,
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}


          {/* Suitability */}
          <Text style={styles.crLabel}>Suitability</Text>
          <View style={styles.amenitiesRow}>
            {Object.keys(defaultSuitability).map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => toggleSuitability(key)}
                activeOpacity={isCreateMode ? 0.7 : 1}
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
                onPress={() => toggleAmenity(key)}
                activeOpacity={isCreateMode ? 0.7 : 1}
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

          {isCreateMode && (
            <TouchableOpacity
              style={styles.primaryButton}
              disabled={justSaved}
              onPress={handleSavePlace}
            >
              <Text style={styles.primaryButtonText}>
                {justSaved ? "Saved ✓" : "Add this place"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => onNavigate(place)}
            >
              <Text style={styles.primaryActionText}>Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                if (hasRoute) {
                  onClearRoute?.();
                } else {
                  onRoute?.(place);
                }
              }}
            >
              <Text>{hasRoute ? "Clear Route" : "Route"}</Text>
            </TouchableOpacity>
          </View>

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
      maxHeight: "55%",
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
    
  };
}

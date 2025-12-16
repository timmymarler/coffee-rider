import { db, storage } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useContext, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
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
  onPlaceCreated,
  onNavigate,
  onRoute,
}) {
  const styles = createStyles(theme);
  const auth = useContext(AuthContext);
  const currentUser = auth?.user || null;
  const currentUid = currentUser?.uid || null;

  const isManualOnly = place?.source === "manual";
  const isGoogle = place?.source === "google";
  const isGoogleNew = place?.source === "google-new";
  const isCr = place?.source === "cr";

  const isCreateMode = isManualOnly || isGoogleNew;

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

  const distanceKm = useMemo(() => {
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

    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  }, [userLocation, place]);

  const photos = useMemo(() => {
    return [
      ...(Array.isArray(place.photos) ? place.photos : []),
      ...(Array.isArray(place.googlePhotoUrls)
        ? place.googlePhotoUrls
        : []),
    ].filter(Boolean);
  }, [place]);

  /* ------------------------------------------------------------------ */
  /* HELPERS                                                           */
  /* ------------------------------------------------------------------ */

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
    } catch (err) {
      console.log("[SAVE PLACE] failed", err);
    }
  };

  /* ------------------------------------------------------------------ */
  /* ADD PHOTO                                                         */
  /* ------------------------------------------------------------------ */

  const handleAddPhoto = async () => {
    if (!place.id) return;

    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const filename = `${place.id}/${Date.now()}.jpg`;
    const storageRef = ref(storage, `places/${filename}`);

    const img = await fetch(uri);
    const bytes = await img.blob();
    await uploadBytes(storageRef, bytes);

    const downloadUrl = await getDownloadURL(storageRef);
    await updateDoc(doc(db, "places", place.id), {
      photos: arrayUnion(downloadUrl),
    });
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
      <View style={styles.info}>
        <Text style={styles.title}>
          {isCreateMode ? "Save this place" : place.title}
        </Text>

        {distanceKm && (
          <Text style={styles.distance}>{distanceKm} km away</Text>
        )}

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
            onPress={handleSavePlace}
          >
            <Text style={styles.primaryButtonText}>Save place</Text>
          </TouchableOpacity>
        )}
      </View>
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
      backgroundColor: theme.colors.primaryLight,
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
    photoContainer: { height: 180 },
    photo: { width: screenWidth, height: 180 },
    info: { padding: 12 },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.accentDark,
    },
    crLabel: {
      marginTop: 16,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
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
  };
}

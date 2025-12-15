import { db, storage } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useContext, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const screenWidth = Dimensions.get("window").width;

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

  // "Creation mode" covers both manual drops and Google → CR imports
  const isCreateMode = isManualOnly || isGoogleNew;

  // ----------------------------
  // Local editable fields (create mode)
  // ----------------------------
  const [manualName, setManualName] = useState(
    isGoogleNew ? place.title ?? "" : ""
  );
  const [manualType, setManualType] = useState(
    isGoogleNew ? place.type ?? null : null
  );
  const [commentText, setCommentText] = useState("");

  // Suitability / amenities state for create mode
  const [suitabilityState, setSuitabilityState] = useState(() => {
    if (place?.suitability) {
      return { ...defaultSuitability, ...place.suitability };
    }
    return { ...defaultSuitability };
  });

  const [amenitiesState, setAmenitiesState] = useState(() => {
    if (place?.amenities) {
      return { ...defaultAmenities, ...place.amenities };
    }
    return { ...defaultAmenities };
  });

  const [ratingInput, setRatingInput] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Distance (if userLocation ever gets passed in)
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

  // Google photos + CR photos merged (future: add "photos" array for Storage)
  const photos = useMemo(() => {
    return [
      ...(Array.isArray(place.photos) ? place.photos : []),
      ...(Array.isArray(place.googlePhotoUrls)
        ? place.googlePhotoUrls
        : []),
    ].filter(Boolean);
  }, [place]);

  // ----- CR RATING DATA (view mode) -----
  const crAverage = place.crRatings?.average ?? null;
  const crCount = place.crRatings?.count ?? 0;
  const userRatingFromPlace =
    currentUid && place.crRatings?.users?.[currentUid]?.rating != null
      ? place.crRatings.users[currentUid].rating
      : null;
  const comments = place.crRatings?.comments || []; // placeholder shape only

  // Amenity rendering util
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

  const toggleSuitability = (key) => {
    if (!isCreateMode) return;
    setSuitabilityState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAmenity = (key) => {
    if (!isCreateMode) return;
    setAmenitiesState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePlace = async () => {
    if (!isCreateMode) return;
    if (!currentUid) {
      console.log("[SAVE PLACE] missing auth uid");
      return;
    }

    const name =
      manualName.trim() ||
      place.title?.trim() ||
      "Untitled place";

    const latitude = place.latitude;
    const longitude = place.longitude;

    if (!latitude || !longitude) {
      console.log("[SAVE PLACE] missing coordinates");
      return;
    }

    try {
      // Build ratings structure
      const rating = ratingInput || 0;
      const crRatings =
        rating > 0
          ? {
              average: rating,
              count: 1,
              users: {
                [currentUid]: {
                  rating,
                  createdAt: serverTimestamp(),
                  createdBy: currentUid,
                },
              },
            }
          : {
              average: null,
              count: 0,
              users: {},
            };

      // Create CR place
      const placeRef = await addDoc(collection(db, "places"), {
        name,
        type: manualType ?? place.type ?? null,
        location: {
          latitude,
          longitude,
        },
        suitability: suitabilityState,
        amenities: amenitiesState,
        googlePhotoUrls: place.googlePhotoUrls || [],
        googleRating: place.rating ?? null,
        googleUserRatingsTotal: place.userRatingsTotal ?? 0,        
        createdAt: serverTimestamp(),
        createdBy: currentUid,
        source: "cr",
        crRatings,
      });

      // Optional first comment
      if (commentText.trim()) {
        await addDoc(collection(placeRef, "comments"), {
          text: commentText.trim(),
          rating: rating > 0 ? rating : null,
          createdAt: serverTimestamp(),
          createdBy: currentUid,
        });
      }

      // Promote to CR mode for UI
      const newPlace = {
        id: placeRef.id,
        source: "cr",
        title: name,
        latitude,
        longitude,
        type: manualType ?? place.type ?? null,
        suitability: suitabilityState,
        amenities: amenitiesState,
        crRatings,
        googlePhotoUrls: place.googlePhotoUrls || [],
      };

      onPlaceCreated?.(newPlace);
    } catch (err) {
      console.log("[SAVE PLACE] failed", err);
    }
  };

  const handlePostCommentOnCr = async () => {
    if (!isCr) return;
    if (!currentUid) {
      console.log("[COMMENT] missing auth uid");
      return;
    }
    if (!commentText.trim()) return;
    if (!place.id) return;

    try {
      const placeRef = doc(db, "places", place.id);
      await addDoc(collection(placeRef, "comments"), {
        text: commentText.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUid,
      });

      setCommentText("");
    } catch (err) {
      console.log("[COMMENT] failed", err);
    }
  };

  const renderStars = (value, muted = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <MaterialCommunityIcons
          key={i}
          name={i <= value ? "star" : "star-outline"}
          size={18}
          color={muted ? theme.colors.subtleText : theme.colors.primary}
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={{ flexDirection: "row" }}>{stars}</View>;
  };

  const renderInteractiveStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Pressable key={i} onPress={() => setRatingInput(i)}>
          <MaterialCommunityIcons
            name={i <= ratingInput ? "star" : "star-outline"}
            size={20}
            color={theme.colors.primary}
            style={{ marginRight: 4 }}
          />
        </Pressable>
      );
    }
    return <View style={{ flexDirection: "row" }}>{stars}</View>;
  };

  const renderSuitabilityRow = (values) => {
    return (
      <View style={styles.amenitiesRow}>
        {/* Bikers */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleSuitability("bikers")}
        >
          {amenityIcon(values.bikers, "motorbike")}
        </TouchableOpacity>

        {/* Scooters */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleSuitability("scooters")}
        >
          {amenityIcon(values.scooters, "moped")}
        </TouchableOpacity>

        {/* Cyclists */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleSuitability("cyclists")}
        >
          {amenityIcon(values.cyclists, "bike")}
        </TouchableOpacity>

        {/* Walkers */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleSuitability("walkers")}
        >
          {amenityIcon(values.walkers, "walk")}
        </TouchableOpacity>

        {/* Cars */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleSuitability("cars")}
        >
          {amenityIcon(values.cars, "car")}
        </TouchableOpacity>

        {/* EV Drivers */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleSuitability("evDrivers")}
        >
          {amenityIcon(values.evDrivers, "car-electric")}
        </TouchableOpacity>
      </View>
    );
  };

  const renderAmenitiesRow = (values) => {
    return (
      <View style={styles.amenitiesRow}>
        {/* Parking */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleAmenity("parking")}
        >
          {amenityIcon(values.parking, "parking")}
        </TouchableOpacity>

        {/* Motorcycle Parking */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleAmenity("motorcycleParking")}
        >
          {amenityIcon(values.motorcycleParking, "motorbike")}
        </TouchableOpacity>

        {/* EV Charger */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleAmenity("evCharger")}
        >
          {amenityIcon(values.evCharger, "ev-plug-ccs2")}
        </TouchableOpacity>

        {/* Toilets */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleAmenity("toilets")}
        >
          {amenityIcon(values.toilets, "toilet")}
        </TouchableOpacity>

        {/* Pet Friendly */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleAmenity("petFriendly")}
        >
          {amenityIcon(values.petFriendly, "dog-side")}
        </TouchableOpacity>

        {/* Disabled Access */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleAmenity("disabledAccess")}
        >
          {amenityIcon(
            values.disabledAccess,
            "wheelchair-accessibility"
          )}
        </TouchableOpacity>

        {/* Outdoor Seating */}
        <TouchableOpacity
          activeOpacity={isCreateMode ? 0.7 : 1}
          onPress={() => toggleAmenity("outdoorSeating")}
        >
          {amenityIcon(values.outdoorSeating, "table-picnic")}
        </TouchableOpacity>
      </View>
    );
  };

  const suitabilityForRender = isCreateMode
    ? suitabilityState
    : { ...defaultSuitability, ...(place.suitability || {}) };

  const amenitiesForRender = isCreateMode
    ? amenitiesState
    : { ...defaultAmenities, ...(place.amenities || {}) };

  const showCommentBoxForCreate = isCreateMode;
  const showCommentBoxForCr = isCr && !!currentUid;

  const handleAddPhoto = async () => {
    if (!place.id) return;

    // Ask permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      console.log("Permission denied");
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const filename = `${place.id}/${Date.now()}.jpg`;
    const storageRef = ref(storage, `places/${filename}`);

    // Upload
    const img = await fetch(uri);
    const bytes = await img.blob();
    await uploadBytes(storageRef, bytes);

    // Get URL
    const downloadUrl = await getDownloadURL(storageRef);

    // Append into photos[]
    const placeRef = doc(db, "places", place.id);
    await updateDoc(placeRef, {
      photos: arrayUnion(downloadUrl),
    });

    console.log("Photo added:", downloadUrl);
  };

  return (
    <View style={styles.container}>
      {/* Close button */}
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      {/* Photo carousel */}
      <View style={styles.photoContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: screenWidth, height: 180 }}
          onScroll={(e) => {
            const index = Math.round(
              e.nativeEvent.contentOffset.x / screenWidth
            );
            setPhotoIndex(index);
          }}
          scrollEventThrottle={16}
        >
          {photos.map((p, idx) => (
            <View key={idx} style={{ width: screenWidth, height: 180 }}>
              <Image
                source={{ uri: p }}
                style={styles.photo}
                onError={() => console.log("IMAGE LOAD ERROR:", p)}
              />
            </View>
          ))}
        </ScrollView>

        {/* Dot indicator */}
        <View style={styles.dots}>
          {photos.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === photoIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </View>
      {/* Add Photo button (CR mode + logged-in) */}
      {isCr && currentUid && (
        <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhoto}>
          <Ionicons name="camera" size={18} color={theme.colors.primaryDark} />
          <Text style={styles.addPhotoText}>Add Photo</Text>
        </TouchableOpacity>
      )}

      {/* Info */}
      <View style={styles.info}>
        {/* Header */}
        {isCreateMode ? (
          <>
            <Text style={styles.title}>Save this place</Text>
            <Text style={styles.subtitle}>
              Add details for Coffee Rider
            </Text>
          </>
        ) : (
          <Text style={styles.title}>{place.title}</Text>
        )}

        {/* Manual / Google-new input area */}
        {isCreateMode && (
          <View style={styles.manualSection}>
            <TextInput
              style={styles.input}
              placeholder="Place name"
              value={manualName}
              editable={isManualOnly} // google-new is read-only name
              onChangeText={(text) => setManualName(text)}
            />

            <Text style={styles.crLabel}>Type</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => setManualType("cafe")} // temporary until you add a real picker
            >
              <Text style={styles.selectBoxText}>
                {manualType ? manualType : "Select type"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        )}

        {place.address && !isCreateMode && (
          <Text style={styles.address}>{place.address}</Text>
        )}

        {/* Google Rating + Badge */}
        {(place.rating || place.googleRating) && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingText}>
              ⭐ {(place.rating ?? place.googleRating).toFixed(1)} (
              {place.userRatingsTotal ?? place.googleUserRatingsTotal ?? 0})
            </Text>
            <MaterialCommunityIcons
              name="google"
              size={18}
              color={theme.colors.text}
              style={styles.googleBadge}
            />
          </View>
        )}

        {/* CR Average Rating (view mode) */}
        {crAverage != null && !isCreateMode && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.crLabel}>Coffee Rider Rating</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              {renderStars(crAverage, true)}
              <Text style={styles.crCountText}>
                {crAverage.toFixed(1)} ({crCount})
              </Text>
            </View>
          </View>
        )}

        {/* Your Rating */}
        {currentUid && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.crLabel}>Your Rating</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              {isCreateMode
                ? renderInteractiveStars()
                : renderStars(userRatingFromPlace || 0, false)}
            </View>
          </View>
        )}

        {/* Price */}
        {place.priceRange && (
          <Text style={styles.price}>Price: {place.priceRange}</Text>
        )}

        {/* Distance */}
        {distanceKm && (
          <Text style={styles.distance}>{distanceKm} km away</Text>
        )}

        {/* Suitability */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.crLabel}>Suitability</Text>
          {renderSuitabilityRow(suitabilityForRender)}
        </View>

        {/* Amenities */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.crLabel}>Amenities</Text>
          {renderAmenitiesRow(amenitiesForRender)}
        </View>

        {/* ----- CR COMMENTS LIST (view mode) ----- */}
        {comments.length > 0 && !isCreateMode && (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.crLabel}>Coffee Rider Reviews</Text>

            {comments.map((c, i) => (
              <View key={i} style={styles.commentCard}>
                {c.rating != null && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    {renderStars(c.rating, false)}
                  </View>
                )}
                {c.userName && (
                  <Text style={styles.commentUser}>{c.userName}</Text>
                )}
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ----- Comment + Save / Post Section ----- */}
        {(showCommentBoxForCreate || showCommentBoxForCr) && (
          <View style={styles.commentSection}>
            <TextInput
              multiline
              placeholder={
                isCreateMode
                  ? "Optional comment about this place"
                  : "Add a Coffee Rider review"
              }
              value={commentText}
              onChangeText={setCommentText}
              style={styles.commentBox}
            />

            {isCreateMode ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSavePlace}
              >
                <Text style={styles.primaryButtonText}>
                  Save place
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handlePostCommentOnCr}
              >
                <Text style={styles.primaryButtonText}>
                  Post comment
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Action buttons (only when not in create mode) */}
      {!isCreateMode && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={onNavigate}>
            <Ionicons
              name="navigate"
              size={20}
              color={theme.colors.primaryLight}
            />
            <Text style={styles.actionText}>Navigate</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={onRoute}>
            <MaterialCommunityIcons
              name="map-marker-path"
              size={20}
              color={theme.colors.primaryLight}
            />
            <Text style={styles.actionText}>Route</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

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
      zIndex: 999,
      elevation: 999,
    },

    closeButton: {
      position: "absolute",
      top: 12,
      right: 12,
      zIndex: 9999,
      backgroundColor: "rgba(0,0,0,0.5)",
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },

    photoContainer: {
      width: "100%",
      height: 180,
      backgroundColor: theme.colors.card,
    },

    photo: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },

    dots: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
    },

    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.primaryLight,
      margin: 3,
    },

    dotActive: {
      backgroundColor: theme.colors.accent,
    },

    info: {
      padding: 12,
    },

    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.accentDark,
    },

    subtitle: {
      fontSize: 14,
      color: theme.colors.accentMid,
      marginTop: 2,
      marginBottom: 8,
    },

    manualSection: {
      marginTop: 8,
      marginBottom: 8,
    },

    input: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.accentMid,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 8,
      color: theme.colors.text,
      backgroundColor: theme.colors.card,
    },

    address: {
      fontSize: 14,
      color: theme.colors.accentDark,
      marginTop: 4,
    },

    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },

    ratingText: {
      fontSize: 14,
      color: theme.colors.text,
      marginRight: 6,
    },

    googleBadge: {
      opacity: 0.8,
    },

    price: {
      marginTop: 6,
      fontSize: 14,
      color: theme.colors.text,
    },

    distance: {
      marginTop: 4,
      fontSize: 14,
      color: theme.colors.text,
    },

    amenitiesRow: {
      flexDirection: "row",
      marginTop: 8,
      alignItems: "center",
      flexWrap: "wrap",
    },

    amenityIcon: {
      marginRight: 14,
      marginBottom: 6,
      color: theme.colors.accentDark,
    },

    amenityDisabled: {
      opacity: 0.32,
    },

    crLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },

    crCountText: {
      fontSize: 14,
      color: theme.colors.subtleText,
      marginLeft: 6,
    },

    commentCard: {
      backgroundColor: theme.colors.cardElevated,
      padding: 10,
      borderRadius: 8,
      marginTop: 10,
    },

    commentUser: {
      color: theme.colors.text,
      fontWeight: "600",
      marginTop: 4,
    },

    commentText: {
      color: theme.colors.text,
      marginTop: 2,
    },

    commentSection: {
      marginTop: 16,
    },

    commentBox: {
      backgroundColor: theme.colors.cardElevated,
      borderRadius: 8,
      color: theme.colors.text,
      padding: 10,
      minHeight: 60,
    },

    primaryButton: {
      marginTop: 10,
      paddingVertical: 10,
      backgroundColor: theme.colors.accentDark,
      borderRadius: 20,
      alignItems: "center",
    },

    primaryButtonText: {
      color: theme.colors.primaryDark,
      fontWeight: "600",
    },

    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      padding: 12,
      backgroundColor: theme.colors.cardElevated,
    },

    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.accentMid,
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 20,
    },

    actionText: {
      color: theme.colors.primaryDark,
      marginLeft: 8,
      fontSize: 14,
    },

    selectBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.accentMid,
    },

    selectBoxText: {
      color: theme.colors.text,
      fontSize: 15,
    },

    addPhotoButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accentMid,
      paddingVertical: 8,
      marginTop: 6,
    },

    addPhotoText: {
      marginLeft: 6,
      color: theme.colors.primaryDark,
      fontWeight: "600",
    },

  };
}

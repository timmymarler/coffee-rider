import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import { useContext, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput, TouchableOpacity, View
} from "react-native";

const screenWidth = Dimensions.get("window").width;

export default function PlaceCard({
  place,
  onClose,
  userLocation,
  onPlaceCreated,
  onNavigate,
  onRoute,
}) {
  const styles = createStyles(theme);
  const user = useContext(AuthContext);
console.log("[AUTH DEBUG]", user);

  const isManual = place?.source === "manual";
  const isGoogle = place?.source === "google";
  const isCr = place?.source === "cr";

  const [manualName, setManualName] = useState("");
  const [manualType, setManualType] = useState(null);
  const [manualComment, setManualComment] = useState("");

  const [photoIndex, setPhotoIndex] = useState(0);
  const [commentText, setCommentText] = useState("");

  const photos = useMemo(() => {
    return [
      ...(Array.isArray(place.photos) ? place.photos : []),
      ...(Array.isArray(place.googlePhotoUrls) ? place.googlePhotoUrls : []),
    ].filter(Boolean);
  }, [place]);

  // Distance
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

  // ----- CR RATING PLACEHOLDERS -----
  const crAverage = place.crRatings?.average || null;
  const crCount = place.crRatings?.count || 0;
  const userRating = user ? place.crRatings?.users?.[user.uid]?.rating : null;
  const comments = place.crRatings?.comments || []; // array of { userName, rating, text }

  // Render muted or full-colour CR stars
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

  const handleManualCommentSubmit = async () => {
  const createdBy = user?.user?.uid;
  if (!createdBy) {
    console.log("[MANUAL CREATE] missing auth uid");
    return;
  }    if (place.source !== "manual") return;
    if (!manualName?.trim() || !manualComment?.trim()) return;

    try {
      // 1. Create place
      const placeRef = await addDoc(collection(db, "places"), {
        name: manualName.trim(),
        type: manualType ?? null,
        location: {
          latitude: place.latitude,
          longitude: place.longitude,
        },
        createdAt: serverTimestamp(),
        createdBy: createdBy,
        source: "manual",
      });

      // 2. Add first comment
      await addDoc(collection(placeRef, "comments"), {
        text: manualComment.trim(),
        createdAt: serverTimestamp(),
        createdBy: createdBy,
      });

      // 3. Promote PlaceCard to CR mode (no remount)
      onPlaceCreated?.({
        id: placeRef.id,
        source: "cr",
        title: manualName.trim(),
        latitude: place.latitude,
        longitude: place.longitude,
        type: manualType ?? null,
      });

    } catch (err) {
      console.log("[MANUAL CREATE] failed", err);
    }
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

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title}>
          {isManual ? "New place" : place.title}
        </Text>

        {isManual && (
          <Text style={styles.subtitle}>
            Add details for this location
          </Text>
        )}

        {isManual && (
          <View style={styles.manualSection}>
            <TextInput
              style={styles.input}
              placeholder="Place name"
              value={manualName}
              onChangeText={(text) => {
                setManualName(text);
                console.log("[MANUAL] name:", text);
              }}
            />

            <Text style={styles.crLabel}>Type</Text>
            <TouchableOpacity
              onPress={() => {
                setManualType("cafe");
                console.log("[MANUAL] type: cafe");
              }}
            >
              <Text>Select Café</Text>
            </TouchableOpacity>
          </View>
        )}

        {place.address && (
          <Text style={styles.address}>{place.address}</Text>
        )}

        {/* Google Rating + Badge */}
        {place.rating && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingText}>
              ⭐ {place.rating.toFixed(1)} ({place.userRatingsTotal || 0})
            </Text>

            {place.source === "google" && (
              <MaterialCommunityIcons
                name="google"
                size={18}
                color={theme.colors.text}
                style={styles.googleBadge}
              />
            )}
          </View>
        )}

        {/* ----- CR AVERAGE RATING ----- */}
        {crAverage != null && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.crLabel}>Coffee Rider Rating</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              {renderStars(crAverage, true)}
              <Text style={styles.crCountText}>
                {crAverage.toFixed(1)} ({crCount})
              </Text>
            </View>
          </View>
        )}

        {/* ----- USER RATING ----- */}
        {user && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.crLabel}>Your Rating</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              {renderStars(userRating || 0, false)}
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

        {/* Amenities */}
        <View style={styles.amenitiesRow}>
          {amenityIcon(place.amenities?.bikes, "motorbike")}
          {amenityIcon(place.amenities?.scooters, "scooter")}
          {amenityIcon(place.amenities?.cyclists, "bicycle", "ion")}
          {amenityIcon(place.amenities?.cars, "car", "ion")}
          {amenityIcon(place.amenities?.pets, "dog")}
          {amenityIcon(place.amenities?.disability, "wheelchair-accessibility")}
        </View>

        {/* ----- CR COMMENTS LIST ----- */}
        {comments.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.crLabel}>Coffee Rider Reviews</Text>

            {comments.map((c, i) => (
              <View key={i} style={styles.commentCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {renderStars(c.rating, false)}
                </View>
                <Text style={styles.commentUser}>{c.userName}</Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ----- ADD COMMENT (LOGGED IN ONLY) ----- */}
          {isManual && (
            <View style={styles.commentSection}>
              <TextInput
                multiline
                placeholder="Add a comment"
                value={manualComment}
                onChangeText={setManualComment}
              />

              <TouchableOpacity
                style={styles.commentSubmit}
                onPress={handleManualCommentSubmit}
                disabled={!manualComment.trim()}
              >
                <Text style={styles.commentSubmitText}>
                  Post comment
                </Text>
              </TouchableOpacity>
            </View>
          )}
      </View>

      {/* Action buttons */}
      {!isManual && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={onNavigate}>
            <Ionicons name="navigate" size={20} color={theme.colors.primaryLight} />
            <Text style={styles.actionText}>Navigate</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={onRoute}>
            <MaterialCommunityIcons name="map-marker-path" size={20} color={theme.colors.primaryLight} />
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
      color: theme.colors.accentMid,
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
      marginTop: 12,
      alignItems: "center",
    },

    amenityIcon: {
      marginRight: 14,
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

    commentInputBlock: {
      marginTop: 20,
    },

    commentBox: {
      backgroundColor: theme.colors.cardElevated,
      borderRadius: 8,
      color: theme.colors.text,
      padding: 10,
      marginTop: 6,
      minHeight: 60,
    },

    commentSubmit: {
      marginTop: 10,
      paddingVertical: 8,
      backgroundColor: theme.colors.accentDark,
      borderRadius: 20,
      alignItems: "center",
    },
    commentSubmitText: {
      color: theme.colors.primaryDark,
      fontWeight: 600
    },

    submitButton: {
      marginTop: 10,
      paddingVertical: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 20,
      alignItems: "center",
    },

    submitText: {
      color: theme.colors.accent,
      fontSize: 14,
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
  };
}

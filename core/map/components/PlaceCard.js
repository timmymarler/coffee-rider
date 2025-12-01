import { AuthContext } from "@context/AuthContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { submitCRRating } from "@lib/ratings";
import { getTheme } from "@themes";
import { useContext, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

// Get both width and height so we can cap card height
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function PlaceCard({
  place,
  onClose,
  userLocation,
  onNavigate,
  onRoute,
}) {
  const theme = getTheme();
  const styles = createStyles(theme);

  // CORRECT: destructure user from the AuthContext
  const { user } = useContext(AuthContext);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [commentText, setCommentText] = useState("");

  const photos = useMemo(() => {
    return [
      ...(Array.isArray(place.photos) ? place.photos : []),
      ...(Array.isArray(place.googlePhotoUrls)
        ? place.googlePhotoUrls
        : []),
    ].filter(Boolean);
  }, [place]);

  // Distance calculation
  const distanceKm = useMemo(() => {
    if (
      !userLocation ||
      typeof userLocation.latitude !== "number" ||
      typeof userLocation.longitude !== "number" ||
      typeof place.latitude !== "number" ||
      typeof place.longitude !== "number"
    ) {
      return null;
    }

    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;

    const dLat = toRad(place.latitude - userLocation.latitude);
    const dLng = toRad(place.longitude - userLocation.longitude);
    const lat1 = toRad(userLocation.latitude);
    const lat2 = toRad(place.latitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLng / 2) ** 2 *
        Math.cos(lat1) *
        Math.cos(lat2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [userLocation, place]);

  const distanceMiles = distanceKm
    ? (distanceKm * 0.621371).toFixed(1)
    : null;

  // ----- CR RATING LOGIC -----
  const crAverage = place.crRatings?.average || null;
  const crCount = place.crRatings?.count || 0;
  const comments = place.crRatings?.comments || [];

  // Interactive user rating (initialises from Firestore if exists)
  const [userRating, setUserRating] = useState(
    user && place.crRatings?.users?.[user.uid]?.rating
      ? place.crRatings.users[user.uid].rating
      : 0
  );
 
const renderCombinedInteractiveStars = (yourValue, averageValue, onChange) => {
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    let iconName = "star-outline";
    let iconColor = theme.colors.subtleText;

    // Your rating (light)
    if (i <= yourValue) {
      iconName = "star";
      iconColor = theme.colors.primaryLight;
    }
    // CR average (dark)
    else if (i <= averageValue) {
      iconName = "star";
      iconColor = theme.colors.primary;
    }

    stars.push(
      <Pressable
        key={i}
        onPress={() => {
          if (!user || user.isAnonymous) return; // permissions
          onChange(i);
        }}
        style={{ padding: 1 }}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={20}
          color={iconColor}
          style={{ marginRight: 2 }}
        />
      </Pressable>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {stars}
    </View>
  );
};

  
  // Render Price Range
  const renderPriceRange = (value) => {
    const max = 4; // £ to ££££
    const symbols = [];

    for (let i = 1; i <= max; i++) {
      symbols.push(
        <Text
          key={i}
          style={{
            fontSize: 20,
            fontWeight: "600",
            marginRight: 4,
            color: i <= value ? theme.colors.primaryLight : theme.colors.primary,
          }}
        >
          £
        </Text>
      );
    }

    return <View style={{ flexDirection: "row", marginTop: 8 }}>{symbols}</View>;
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

  return (
    <View style={styles.container}>
      {/* Close */}
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      {/* Photo Carousel */}
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
      <View>
        <Text style={styles.title}>{place.title}</Text>
      </View>
      {/* SCROLLABLE INFO */}
      <ScrollView
        style={styles.info}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
      <View>
        {place.address && (
          <Text style={styles.address}>{place.address}</Text>
        )}
      </View>
      <View>
        {/* Distance */}
        {distanceMiles && (
          <Text style={styles.distance}>
            {distanceMiles} miles away (straight line distance)
          </Text>
        )}
      </View>
        <View style={{ marginTop: 12 }}>
          <Text style={styles.crLabel}>Ratings</Text>
        </View>
        {/* GOOGLE RATING */}
        {place.rating && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingText}>
              ⭐ {place.rating.toFixed(1)} ({place.userRatingsTotal || 0})
            </Text>
            {place.rating && (
              <MaterialCommunityIcons
                name="google"
                size={18}
                color={theme.colors.text}
                style={styles.googleBadge}
              />
            )}
          </View>
        )}

        {/* CR AVERAGE */}
          <View style={{ marginTop: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
              }}
            >
            {renderCombinedInteractiveStars(userRating, crAverage, setUserRating)}
            <Text style={styles.crCountText}>
              {crAverage?.toFixed(1)} ({crCount})
            </Text>
            </View>
          </View>
        

        {/* Price */}

        {place.priceRange != null && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.crLabel}>Price Range</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 1,
              }}
            >
            {place.priceLevel && (
              <View style={{ marginTop: 4 }}>
                {renderPriceRange(place.priceLevel)}
              </View>
            )}
            </View>
          </View>
        )}

        {/* Amenities */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.crLabel}>Facilities</Text>
          <View style={styles.amenitiesRow}>
            {amenityIcon(place.amenities?.bikes, "motorbike")}
            {amenityIcon(place.amenities?.scooters, "moped")}
            {amenityIcon(place.amenities?.cyclists, "bike")}
            {amenityIcon(place.amenities?.cars, "car-side")}
            {amenityIcon(place.amenities?.evcharger, "power-plug")}
            {amenityIcon(place.amenities?.pets, "dog-side")}
            {amenityIcon(
              place.amenities?.disability,
              "wheelchair-accessibility"
            )}
          </View>
        </View>

        {/* ADD COMMENT */}
        {user && (
          <View style={styles.commentInputBlock}>
            <Text style={styles.crLabel}>Add a Comment</Text>

            <TextInput
              style={styles.commentBox}
              placeholder="Write a comment…"
              placeholderTextColor={theme.colors.subtleText}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />

            <Pressable
              style={styles.submitButton}
              onPress={async () => {
                if (!user || user.isAnonymous) return;

                try {
                  const displayName =
                    user.displayName ??
                    user.email?.split("@")[0] ??
                    "Unknown Rider";

                  const updated = await submitCRRating(
                    place.cafeId,
                    user.uid,
                    displayName,
                    userRating || 0,
                    commentText.trim()
                  );

                  place.crRatings = updated;
                  setUserRating(updated.users[user.uid].rating);

                  setCommentText("");
                } catch (err) {
                  console.error("CR rating submit error:", err);
                }
              }}
            >
              <Text style={styles.submitText}>Submit</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* FOOTER BUTTONS */}
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
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      overflow: "hidden",
      zIndex: 999,
      elevation: 999,
      // Cap the card height so the top stays on-screen
      maxHeight: screenHeight * 0.7,
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
      color: theme.colors.accent,
    },

    address: {
      fontSize: 14,
      color: theme.colors.primaryLight,
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
      color: theme.colors.primaryLight,
    },

    distance: {
      marginTop: 4,
      fontSize: 14,
      color: theme.colors.primaryLight,
    },

    amenitiesRow: {
      flexDirection: "row",
      marginTop: 12,
      alignItems: "center",
    },

    amenityIcon: {
      marginRight: 14,
      color: theme.colors.primaryLight,
    },

    amenityDisabled: {
      opacity: 0.32,
    },

    crLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.accentDark,
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
      backgroundColor: theme.colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 20,
    },

    actionText: {
      color: theme.colors.accent,
      marginLeft: 8,
      fontSize: 14,
    },
  };
}

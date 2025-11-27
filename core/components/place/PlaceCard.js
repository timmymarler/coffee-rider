// PlaceCard.js
import { theme } from "@config/theme";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

function getHeroImage(google, coffeeRider) {
  // Try Coffee Rider photos first
  const crPhoto =
    coffeeRider?.photoUrl ||
    coffeeRider?.imageUrl ||
    (Array.isArray(coffeeRider?.photos) ? coffeeRider.photos[0] : null);

  if (crPhoto) return crPhoto;

  // Then Google photo
  const photoRef = google?.photos?.[0]?.photo_reference;
  if (photoRef) {
    return (
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_KEY}`
    );
  }

  return null;
}

function renderStars(value) {
  const rating = value || 0;
  const full = Math.round(rating);

  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < full ? "star" : "star-outline"}
          size={16}
          color={theme.colors.primaryLight}
        />
      ))}
      {rating > 0 && (
        <Text style={styles.ratingNumber}>{rating.toFixed(1)}</Text>
      )}
    </View>
  );
}

export default function PlaceCard({
  google,
  coffeeRider,
  onClose,
  onNavigate,
  onAddWaypoint
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true
    }).start();
  }, [slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished && onClose) onClose();
    });
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
    extrapolate: "clamp"
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
    extrapolate: "clamp"
  });

  const name = google?.name ?? coffeeRider?.name ?? "Unknown place";
  const address =
    google?.formatted_address ?? coffeeRider?.address ?? "Address not available";

  const googleRating = google?.rating;
  const googleRatingsCount = google?.user_ratings_total;
  const crOverall = coffeeRider?.ratingOverall;
  const crService = coffeeRider?.ratingService;
  const crValue = coffeeRider?.ratingValue;
  const priceLevel = google?.price_level ?? coffeeRider?.priceRange;
  const heroImage = getHeroImage(google, coffeeRider);

  const tags = [];
  if (coffeeRider?.bikerFriendly) tags.push("Biker friendly");
  if (coffeeRider?.petFriendly) tags.push("Pet friendly");
  if (coffeeRider?.evCharging) tags.push("EV charging");
  if (coffeeRider?.wheelchairAccess) tags.push("Accessible");

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sliding Card */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ translateY: translateY }]
          }
        ]}
      >
        <View style={styles.cardHandle} />

        {/* Close button */}
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color="#333" />
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero image */}
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Ionicons
                name="cafe"
                size={40}
                color={theme.colors.primaryLight}
              />
            </View>
          )}

          {/* Title & address */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>{name}</Text>
          </View>

          <View style={styles.addressRow}>
            <Ionicons
              name="location-outline"
              size={16}
              color="#666"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.address}>{address}</Text>
          </View>

          {/* Ratings row */}
          <View style={styles.section}>
            {googleRating && (
              <View style={styles.ratingBlock}>
                <Text style={styles.sectionLabel}>Google</Text>
                {renderStars(googleRating)}
                {googleRatingsCount ? (
                  <Text style={styles.subtleText}>
                    {googleRatingsCount} ratings
                  </Text>
                ) : null}
              </View>
            )}

            {crOverall && (
              <View style={styles.ratingBlock}>
                <Text style={styles.sectionLabel}>Coffee Rider</Text>
                {renderStars(crOverall)}
                <View style={styles.subRatingsRow}>
                  {crService && (
                    <Text style={styles.subRatingText}>
                      Service {crService.toFixed(1)}
                    </Text>
                  )}
                  {crValue && (
                    <Text style={styles.subRatingText}>
                      Value {crValue.toFixed(1)}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Price & tags */}
          {(priceLevel || tags.length > 0) && (
            <View style={styles.section}>
              {priceLevel && (
                <View style={styles.priceRow}>
                  <MaterialIcons
                    name="attach-money"
                    size={18}
                    color="#444"
                  />
                  <Text style={styles.priceText}>
                    {typeof priceLevel === "number"
                      ? "£".repeat(priceLevel)
                      : priceLevel}
                  </Text>
                </View>
              )}

              {tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.primaryButton} onPress={onNavigate}>
              <Ionicons
                name="navigate"
                size={18}
                color={theme.colors.onPrimary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.primaryButtonText}>Navigate</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={onAddWaypoint}>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={theme.colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.secondaryButtonText}>Add to route</Text>
            </Pressable>
          </View>

          {/* Placeholder for future: reviews, comments, opening hours */}
          {coffeeRider?.commentCount || google?.opening_hours ? (
            <View style={styles.section}>
              {google?.opening_hours?.weekday_text && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.sectionLabel}>Opening hours</Text>
                  {google.opening_hours.weekday_text.map((line) => (
                    <Text key={line} style={styles.subtleText}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}

              {coffeeRider?.commentCount && (
                <Text style={styles.subtleText}>
                  {coffeeRider.commentCount} Coffee Rider review
                  {coffeeRider.commentCount === 1 ? "" : "s"}
                </Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000"
  },
  cardContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "70%",
    backgroundColor: "#f1f1f4",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 10,
    elevation: 12
  },
  cardHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    marginTop: 6,
    marginBottom: 4
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 12,
    zIndex: 2,
    padding: 6
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 24,
    paddingHorizontal: 16
  },

  heroImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 12
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0"
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.textPrimary
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8
  },
  address: {
    flex: 1,
    fontSize: 14,
    color: "#555"
  },

  section: {
    marginTop: 10,
    marginBottom: 4
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#666",
    marginBottom: 4
  },

  ratingBlock: {
    marginBottom: 8
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2
  },
  ratingNumber: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
    color: "#444"
  },
  subtleText: {
    fontSize: 12,
    color: "#777"
  },
  subRatingsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  subRatingText: {
    fontSize: 12,
    color: "#555",
    marginRight: 10
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  priceText: {
    fontSize: 14,
    color: "#444",
    marginLeft: 2
  },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 6
  },
  tagChip: {
    backgroundColor: "#eee",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  tagText: {
    fontSize: 11,
    color: "#444"
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
    gap: 10
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.primary
  },
  primaryButtonText: {
    color: theme.colors.onPrimary,
    fontWeight: "600",
    fontSize: 15
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontWeight: "600",
    fontSize: 15
  }
});

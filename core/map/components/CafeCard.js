// core/map/components/CafeCard.js
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@theme/index";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export function CafeCard({ cafe, onPress, onNavigatePress }) {
  if (!cafe) return null;

  const {
    name,
    address,
    distanceKm,
    photos = [],
    rating,
    isSponsor,
  } = cafe;

  const photoUri = photos[0];

  return (
    <Pressable style={[styles.card, isSponsor && styles.sponsorBorder]} onPress={onPress}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="cafe" size={24} color={theme.colors.mutedText || "#aaa"} />
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {typeof rating === "number" && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={theme.colors.accentMid || "#ffd700"} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {address && (
          <Text style={styles.address} numberOfLines={1}>
            {address}
          </Text>
        )}

        <View style={styles.bottomRow}>
          {typeof distanceKm === "number" && (
            <Text style={styles.distance}>{distanceKm.toFixed(1)} km</Text>
          )}

          <Pressable
            onPress={onNavigatePress}
            style={styles.navigatePill}
            hitSlop={10}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.navigateText}>Navigate</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(10, 12, 18, 0.96)",
    marginHorizontal: 12,
    marginBottom: 8,
  },
  sponsorBorder: {
    borderWidth: 1,
    borderColor: "#C99A3D", // Coffee Rider gold-ish
  },
  photo: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 10,
  },
  photoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  info: {
    flex: 1,
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    marginLeft: 3,
    fontSize: 13,
    color: "#fff",
  },
  address: {
    fontSize: 12,
    color: theme.colors.mutedText || "#aaa",
    marginTop: 2,
  },
  bottomRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  distance: {
    fontSize: 12,
    color: theme.colors.mutedText || "#bbb",
  },
  navigatePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.accentMid || "#C99A3D",
  },
  navigateText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
});

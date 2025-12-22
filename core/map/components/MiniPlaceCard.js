import { Ionicons } from "@expo/vector-icons";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function MiniPlaceCard({
  place,
  userLocation,
  onNavigate,
  onSave,
  onOpenDetails,
}) {
  if (!place) return null;

  // ---- Data helpers ----
  const photos =
    place.photos && place.photos.length > 0
      ? place.photos
      : place.googlePhotos || [];

  const rating = place.googleRating ?? place.rating;
  const ratingCount = place.googleRatingCount;

  const distance = place.distanceText || place.distance; // whatever you already compute

  const isOpen =
    place.openNow === true
      ? "Open now"
      : place.openNow === false
      ? "Closed"
      : "Hours unknown";

  // Rider signals
  const riderIcons = [];

  if (place.isPopular) {
    riderIcons.push({ icon: "ribbon", color: "#f5c518" });
  }
  if (place.isCafe || place.category === "cafe") {
    riderIcons.push({ icon: "cafe", color: "#fff" });
  }
  if (place.hasParking) {
    riderIcons.push({ icon: "car", color: "#fff" });
  }
  if (place.hasFuel || place.category === "fuel") {
    riderIcons.push({ icon: "flame", color: "#fff" });
  }

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onOpenDetails(place)}
      style={styles.container}
    >
      {/* Name */}
      <Text style={styles.title} numberOfLines={1}>
        {place.title || place.name}
      </Text>

      {/* Photos */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoRow}
        >
          {photos.map((uri, idx) => (
            <Image
              key={idx}
              source={{ uri }}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      {/* Rating + distance */}
      <View style={styles.row}>
        {rating && (
          <Text style={styles.rating}>
            ⭐ {rating}
            {ratingCount ? ` (${ratingCount})` : ""}
          </Text>
        )}
        {distance && <Text style={styles.distance}>{distance}</Text>}
      </View>

      {/* Open / closed */}
      <Text
        style={[
          styles.openStatus,
          isOpen === "Open now" && styles.open,
          isOpen === "Closed" && styles.closed,
        ]}
      >
        {isOpen}
      </Text>

      {/* Rider icons */}
      {riderIcons.length > 0 && (
        <View style={styles.iconRow}>
          {riderIcons.slice(0, 4).map((i, idx) => (
            <Ionicons
              key={idx}
              name={i.icon}
              size={18}
              color={i.color}
              style={{ marginRight: 8 }}
            />
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onNavigate(place)}
        >
          <Ionicons name="navigate" size={18} color="#000" />
          <Text style={styles.primaryText}>Navigate</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onSave?.(place)}>
          <Ionicons name="star-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: "#1b1b1b",
    borderRadius: 16,
    padding: 12,
    elevation: 6,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  photoRow: {
    marginBottom: 8,
  },
  photo: {
    width: 160,
    height: 120,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: "#333",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  rating: {
    color: "#fff",
    marginRight: 12,
  },
  distance: {
    color: "#aaa",
  },
  openStatus: {
    fontSize: 12,
    marginBottom: 6,
    color: "#aaa",
  },
  open: {
    color: "#4CAF50",
  },
  closed: {
    color: "#E57373",
  },
  iconRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5c518",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  primaryText: {
    marginLeft: 6,
    fontWeight: "600",
  },
});

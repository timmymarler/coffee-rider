import { useSavedRoutes } from "@core/map/routes/useSavedRoutes"; // assuming this already exists
import { useWaypointsContext } from "@core/map/waypoints/WaypointsContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SORT_OPTIONS = [
  { key: "created", label: "Created" },
  { key: "distance", label: "Distance" },
  { key: "rating", label: "Rating" },
];

export default function SavedRoutesScreen() {
  const router = useRouter();
  const { routes, loading } = useSavedRoutes();
  const { setPendingSavedRouteId } = useWaypointsContext();

  const [sortBy, setSortBy] = useState("created");

  const sortedRoutes = useMemo(() => {
    if (!routes) return [];

    const list = [...routes];

    switch (sortBy) {
      case "distance":
        return list.sort(
          (a, b) =>
            (a.distanceMeters ?? Infinity) -
            (b.distanceMeters ?? Infinity)
        );

      case "rating":
        return list.sort(
          (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1)
        );

      case "created":
      default:
        return list.sort(
          (a, b) =>
            (b.createdAt?.seconds ?? 0) -
            (a.createdAt?.seconds ?? 0)
        );
    }
  }, [routes, sortBy]);

  function handleOpenRoute(routeId) {
    setPendingSavedRouteId(routeId);
    router.push("/map");
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Routes</Text>

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setSortBy(opt.key)}
              style={[
                styles.sortPill,
                sortBy === opt.key && styles.sortPillActive,
              ]}
            >
              <Text
                style={[
                  styles.sortPillText,
                  sortBy === opt.key && styles.sortPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpenRoute(item.id)}
      >
        <Text style={styles.title} numberOfLines={1}>
          {item.name ||
            item.title ||
            item.destination?.title ||
            "Untitled route"}
        </Text>

        <View style={styles.metaRow}>
          {item.distanceMeters != null && (
            <Text style={styles.meta}>
              {(item.distanceMeters / 1609).toFixed(1)} mi
            </Text>
          )}

          {item.waypoints?.length != null && (
            <Text style={styles.meta}>
              · {item.waypoints.length} stops
            </Text>
          )}

          {item.ratingAvg != null && (
            <Text style={styles.meta}>
              · ★ {item.ratingAvg.toFixed(1)}
            </Text>
          )}
        </View>

        {item.createdAt?.seconds && (
          <Text style={styles.subtle}>
            Created{" "}
            {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>Loading routes…</Text>
      </View>
    );
  }

  if (!sortedRoutes.length) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="map-marker-path"
          size={48}
          color={theme.colors.textMuted}
        />
        <Text style={styles.subtle}>No saved routes yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sortedRoutes}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      stickyHeaderIndices={[0]}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 24,
    backgroundColor: theme.colors.primaryLight
  },

  header: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.accentDark,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 8,
  },

  sortRow: {
    flexDirection: "row",
    gap: 8,
  },

  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },

  sortPillActive: {
    backgroundColor: theme.colors.primary,
  },

  sortPillText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },

  sortPillTextActive: {
    color: theme.colors.onPrimary,
    fontWeight: "600",
  },

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryMid,
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.accentMid,
    marginBottom: 4,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  meta: {
    fontSize: 13,
    color: theme.colors.accentDark,
  },

  subtle: {
    fontSize: 12,
    color: theme.colors.accentDark,
    marginTop: 6,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});

import { CRButton } from "@core/components/ui/CRButton";
import { CRLabel } from "@core/components/ui/CRLabel";
import { CRScreen } from "@core/components/ui/CRScreen";
import { AuthContext } from "@core/context/AuthContext";
import { useAllUserGroups } from "@core/groups/hooks";
import { RIDE_VISIBILITY, shareRoute } from "@core/map/routes/sharedRides";
import { useSavedRoutes } from "@core/map/routes/useSavedRoutes"; // assuming this already exists
import { useWaypointsContext } from "@core/map/waypoints/WaypointsContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { useRouter } from "expo-router";
import { useContext, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// Icon fallback helper - tries MaterialCommunityIcons first, falls back to Ionicons
function IconWithFallback({ mcIcon, ionIcon, size, color, style }) {
  return (
    <MaterialCommunityIcons
      name={mcIcon}
      size={size}
      color={color}
      style={style}
      onError={() => {
        // If the icon fails, render Ionicons as fallback
        return <Ionicons name={ionIcon} size={size} color={color} style={style} />;
      }}
    />
  );
}

const SORT_OPTIONS = [
  { key: "created", label: "Created" },
  { key: "distance", label: "Distance" },
  { key: "rating", label: "Rating" },
];

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "private", label: "Private" },
  { key: "shared", label: "Shared" },
];

export default function SavedRoutesScreen() {
  const router = useRouter();
  // Include public routes only when filter is not strictly 'private'
  const includePublic = filterBy !== "private";
  const { routes, loading } = useSavedRoutes(includePublic);
  const { setPendingSavedRouteId } = useWaypointsContext();
  const { user } = useContext(AuthContext);
  const { groups } = useAllUserGroups(user?.uid);

  const [sortBy, setSortBy] = useState("created");
  const [filterBy, setFilterBy] = useState("all");
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedVisibility, setSelectedVisibility] = useState(RIDE_VISIBILITY.PRIVATE);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [sharing, setSharing] = useState(false);

  const sortedRoutes = useMemo(() => {
    if (!routes) return [];

    let list = [...routes];

    // Apply filter
    switch (filterBy) {
      case "private":
        list = list.filter((r) => !r.visibility || r.visibility === RIDE_VISIBILITY.PRIVATE);
        break;
      case "shared":
        list = list.filter((r) => r.visibility === RIDE_VISIBILITY.GROUP || r.visibility === RIDE_VISIBILITY.PUBLIC);
        break;
      case "all":
      default:
        // No filtering
        break;
    }

    // Apply sort
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
  }, [routes, sortBy, filterBy]);

  function handleOpenRoute(routeId) {
    setPendingSavedRouteId(routeId);
    router.push("/map");
  }

  async function handleShareRoute() {
    if (!selectedRoute) return;
    
    console.log('[SHARE] selectedRoute:', selectedRoute);
    console.log('[SHARE] selectedRoute.id:', selectedRoute.id);
    
    setSharing(true);
    try {
      const groupId = selectedVisibility === RIDE_VISIBILITY.GROUP ? selectedGroupId : null;
      await shareRoute({
        routeId: selectedRoute.id,
        visibility: selectedVisibility,
        groupId: groupId,
      });
      
      Alert.alert("Success", "Route shared!");
      setShareModalVisible(false);
      setSelectedRoute(null);
      setSelectedVisibility(RIDE_VISIBILITY.PRIVATE);
      setSelectedGroupId(null);
    } catch (error) {
      console.error("Error sharing route:", error);
      Alert.alert("Error", "Failed to share route");
    } finally {
      setSharing(false);
    }
  }

  function openShareModal(route) {
    setSelectedRoute(route);
    setSelectedVisibility(RIDE_VISIBILITY.PRIVATE);
    setSelectedGroupId(null);
    setShareModalVisible(true);
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Sort by:</Text>
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

        <Text style={styles.headerLabel}>Filter:</Text>
        <View style={styles.sortRow}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setFilterBy(opt.key)}
              style={[
                styles.sortPill,
                filterBy === opt.key && styles.sortPillActive,
              ]}
            >
              <Text
                style={[
                  styles.sortPillText,
                  filterBy === opt.key && styles.sortPillTextActive,
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
    const groupInfo = item.visibility === RIDE_VISIBILITY.GROUP && item.groupId 
      ? groups?.find(g => g.id === item.groupId)
      : null;

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleOpenRoute(item.id)}
        >
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.name ||
                item.title ||
                item.destination?.title ||
                "Untitled route"}
            </Text>
            {item.visibility === RIDE_VISIBILITY.PUBLIC && (
              <View style={styles.badge}>
                <Ionicons name="globe" size={12} color={theme.colors.accentMid} />
                <Text style={styles.badgeText}>Public</Text>
              </View>
            )}
            {groupInfo && (
              <View style={styles.badge}>
                <MaterialCommunityIcons name="account-multiple" size={12} color={theme.colors.accentMid} />
                <Text style={styles.badgeText}>{groupInfo.name}</Text>
              </View>
            )}
          </View>

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

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleOpenRoute(item.id)}
          >
            <Ionicons
              name="map"
              size={18}
              color={theme.colors.accentMid}
            />
            <Text style={styles.actionLabel}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openShareModal(item)}
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={18}
              color={theme.colors.accentMid}
            />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <CRScreen>
        <View style={styles.center}>
          <Text style={styles.subtle}>Loading routes…</Text>
        </View>
      </CRScreen>
    );
  }

  const emptyMessage = filterBy === "shared" 
    ? "No shared routes"
    : filterBy === "private"
    ? "No private routes"
    : "No saved routes yet";

  return (
    <CRScreen padded={false}>
      <FlatList
        data={sortedRoutes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.center}>
            <MaterialCommunityIcons
              name="map-marker-path"
              size={48}
              color={theme.colors.textMuted}
            />
            <Text style={styles.subtle}>{emptyMessage}</Text>
          </View>
        }
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.list}
      />

      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Route</Text>
            <Text style={styles.modalSubtitle}>
              {selectedRoute?.name || "Untitled route"}
            </Text>

            <ScrollView style={styles.optionsContainer}>
              <CRLabel text="Visibility" />

              {/* Private Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  selectedVisibility === RIDE_VISIBILITY.PRIVATE &&
                    styles.visibilityOptionSelected,
                ]}
                onPress={() => setSelectedVisibility(RIDE_VISIBILITY.PRIVATE)}
              >
                <Ionicons
                  name="lock-closed"
                  size={20}
                  color={
                    selectedVisibility === RIDE_VISIBILITY.PRIVATE
                      ? theme.colors.accentMid
                      : theme.colors.text
                  }
                />
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Private</Text>
                  <Text style={styles.optionDesc}>Only you can see this</Text>
                </View>
                <Ionicons
                  name={
                    selectedVisibility === RIDE_VISIBILITY.PRIVATE
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={theme.colors.accentMid}
                />
              </TouchableOpacity>

              {/* Group Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  selectedVisibility === RIDE_VISIBILITY.GROUP &&
                    styles.visibilityOptionSelected,
                ]}
                onPress={() => setSelectedVisibility(RIDE_VISIBILITY.GROUP)}
              >
                <MaterialCommunityIcons
                  name="account-multiple"
                  size={20}
                  color={
                    selectedVisibility === RIDE_VISIBILITY.GROUP
                      ? theme.colors.accentMid
                      : theme.colors.text
                  }
                />
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Group</Text>
                  <Text style={styles.optionDesc}>Share with a group</Text>
                </View>
                <Ionicons
                  name={
                    selectedVisibility === RIDE_VISIBILITY.GROUP
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={theme.colors.accentMid}
                />
              </TouchableOpacity>

              {selectedVisibility === RIDE_VISIBILITY.GROUP && groups?.length > 0 && (
                <View style={styles.groupSelector}>
                  {groups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupOption,
                        selectedGroupId === group.id &&
                          styles.groupOptionSelected,
                      ]}
                      onPress={() => setSelectedGroupId(group.id)}
                    >
                      <Text
                        style={[
                          styles.groupOptionText,
                          selectedGroupId === group.id &&
                            styles.groupOptionTextSelected,
                        ]}
                      >
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedVisibility === RIDE_VISIBILITY.GROUP && (!groups || groups.length === 0) && (
                <Text style={styles.noGroupsText}>
                  No groups available. Create a group first.
                </Text>
              )}

              {/* Public Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  selectedVisibility === RIDE_VISIBILITY.PUBLIC &&
                    styles.visibilityOptionSelected,
                ]}
                onPress={() => setSelectedVisibility(RIDE_VISIBILITY.PUBLIC)}
              >
                <Ionicons
                  name="globe"
                  size={20}
                  color={
                    selectedVisibility === RIDE_VISIBILITY.PUBLIC
                      ? theme.colors.accentMid
                      : theme.colors.text
                  }
                />
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Public</Text>
                  <Text style={styles.optionDesc}>Anyone can see this</Text>
                </View>
                <Ionicons
                  name={
                    selectedVisibility === RIDE_VISIBILITY.PUBLIC
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={theme.colors.accentMid}
                />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.buttonRow}>
              <CRButton
                onPress={handleShareRoute}
                title="Share"
                loading={sharing}
                style={styles.modalButton}
              />
              <CRButton
                onPress={() => setShareModalVisible(false)}
                title="Cancel"
                style={[styles.modalButton, styles.cancelButton]}
                textStyle={styles.cancelButtonText}
              />
            </View>
          </View>
        </View>
      </Modal>
    </CRScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 24,
  },

  header: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
  },

  headerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: 4,
    marginTop: 8,
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

  cardContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryDark,
    overflow: "hidden",
  },

  card: {
    padding: 14,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.accentMid,
    flex: 1,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(255, 216, 92, 0.15)",
    borderWidth: 1,
    borderColor: theme.colors.accentMid,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  meta: {
    fontSize: 13,
    color: theme.colors.text,
  },

  subtle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },

  actionRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
  },

  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },

  actionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.accentMid,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: "75%",
    width: "85%",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    paddingHorizontal: 20,
    marginBottom: 4,
  },

  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  optionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    maxHeight: 400,
  },

  visibilityOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "transparent",
  },

  visibilityOptionSelected: {
    backgroundColor: "rgba(255, 216, 92, 0.1)",
    borderColor: theme.colors.accentMid,
  },

  optionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  optionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },

  optionDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  groupSelector: {
    marginLeft: 32,
    marginTop: 8,
    marginBottom: 12,
    gap: 6,
  },

  groupOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  groupOptionSelected: {
    backgroundColor: "rgba(255, 216, 92, 0.15)",
    borderColor: theme.colors.accentMid,
  },

  groupOptionText: {
    fontSize: 13,
    color: theme.colors.text,
  },

  groupOptionTextSelected: {
    color: theme.colors.accentMid,
    fontWeight: "600",
  },

  noGroupsText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    marginLeft: 32,
    marginBottom: 12,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
  },

  modalButton: {
    flex: 1,
  },

  cancelButton: {
    backgroundColor: theme.colors.primaryDark,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  cancelButtonText: {
    color: theme.colors.text,
  },
});

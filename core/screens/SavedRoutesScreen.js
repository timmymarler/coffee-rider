import { CRButton } from "@core/components/ui/CRButton";
import { CRLabel } from "@core/components/ui/CRLabel";
import { CRScreen } from "@core/components/ui/CRScreen";
import { AuthContext } from "@core/context/AuthContext";
import { useAllUserGroups } from "@core/groups/hooks";
import { RIDE_VISIBILITY, shareRoute } from "@core/map/routes/sharedRides";
import { useSavedRides } from "@core/map/routes/useSavedRides";
import { useSavedRoutes } from "@core/map/routes/useSavedRoutes";
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
  { key: "public", label: "Public" },
  { key: "shared", label: "Shared" },
];

export default function SavedRoutesScreen() {
  const router = useRouter();
  const { setPendingSavedRouteId } = useWaypointsContext();
  const { user, capabilities } = useContext(AuthContext);
  const { groups } = useAllUserGroups(user?.uid);

  const [viewMode, setViewMode] = useState("routes"); // 'routes' or 'rides'
  const [sortBy, setSortBy] = useState("created");
  const [filterBy, setFilterBy] = useState("all");

  // Include public routes when viewing all or explicitly public
  const includePublic = filterBy === "all" || filterBy === "public";
  const { routes, loading: loadingRoutes } = useSavedRoutes(includePublic);
  const { rides, loading: loadingRides } = useSavedRides();
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
      case "public":
        list = list.filter((r) => r.visibility === RIDE_VISIBILITY.PUBLIC);
        break;
      case "shared":
        list = list.filter((r) => r.visibility === RIDE_VISIBILITY.GROUP);
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

  const sortedRides = useMemo(() => {
    if (!rides) return [];
    // Rides are sorted by completedAt (newest first)
    return [...rides].sort((a, b) => {
      const aTime = a.completedAt?.seconds ?? 0;
      const bTime = b.completedAt?.seconds ?? 0;
      return bTime - aTime;
    });
  }, [rides]);

  const canShare = capabilities?.canShareRoutes === true;

  function handleOpenRoute(routeId) {
    setPendingSavedRouteId(routeId);
    router.push("/map");
  }

  function handleOpenRide(rideId) {
    const ride = sortedRides.find(r => r.id === rideId);
    if (ride) {
      // Store ride polyline as a temporary route so map can display it
      setPendingSavedRouteId(rideId);
      router.push("/map");
    }
  }

  async function handleShareRoute() {
    if (!selectedRoute) return;
    if (!canShare) {
      Alert.alert("Not allowed", "Your account cannot share routes.");
      return;
    }
    
    console.log('[SHARE] selectedRoute:', selectedRoute);
    console.log('[SHARE] selectedRoute.id:', selectedRoute.id);
    
    setSharing(true);
    try {
      const groupId = selectedVisibility === RIDE_VISIBILITY.GROUP ? selectedGroupId : null;
      await shareRoute({
        routeId: selectedRoute.id,
        visibility: selectedVisibility,
        groupId: groupId,
        capabilities,
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
    if (!canShare) {
      Alert.alert("Not allowed", "Your account cannot share routes.");
      return;
    }
    setSelectedRoute(route);
    setSelectedVisibility(RIDE_VISIBILITY.PRIVATE);
    setSelectedGroupId(null);
    setShareModalVisible(true);
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        {/* Routes/Rides Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            onPress={() => setViewMode("routes")}
            style={[
              styles.toggleButton,
              viewMode === "routes" && styles.toggleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === "routes" && styles.toggleButtonTextActive,
              ]}
            >
              Routes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode("rides")}
            style={[
              styles.toggleButton,
              viewMode === "rides" && styles.toggleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === "rides" && styles.toggleButtonTextActive,
              ]}
            >
              Rides
            </Text>
          </TouchableOpacity>
        </View>

        {/* Only show sort/filter for routes view */}
        {viewMode === "routes" && (
          <>
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
          </>
        )}
      </View>
    );
  }

  function renderItem({ item }) {
    const isRide = viewMode === "rides";
    const groupInfo = !isRide && item.visibility === RIDE_VISIBILITY.GROUP && item.groupId 
      ? groups?.find(g => g.id === item.groupId)
      : null;

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => (isRide ? handleOpenRide(item.id) : handleOpenRoute(item.id))}
        >
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.name ||
                item.title ||
                item.destination?.title ||
                "Untitled"}
            </Text>
            {!isRide && item.visibility === RIDE_VISIBILITY.PUBLIC && (
              <View style={styles.badge}>
                <Ionicons name="globe" size={12} color={theme.colors.accentMid} />
                <Text style={styles.badgeText}>Public</Text>
              </View>
            )}
            {!isRide && groupInfo && (
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

            {item.durationSeconds != null && (
              <Text style={styles.meta}>
                · {Math.floor(item.durationSeconds / 60)} mins
              </Text>
            )}

            {!isRide && item.waypoints?.length != null && (
              <Text style={styles.meta}>
                · {item.waypoints.length} stops
              </Text>
            )}

            {!isRide && item.ratingAvg != null && (
              <Text style={styles.meta}>
                · ★ {item.ratingAvg.toFixed(1)}
              </Text>
            )}
          </View>

          {isRide && item.completedAt?.seconds ? (
            <Text style={styles.subtle}>
              Completed{" "}
              {new Date(item.completedAt.seconds * 1000).toLocaleDateString()}
            </Text>
          ) : !isRide && item.createdAt?.seconds ? (
            <Text style={styles.subtle}>
              Created{" "}
              {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
            </Text>
          ) : null}
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (isRide ? handleOpenRide(item.id) : handleOpenRoute(item.id))}
          >
            <Ionicons
              name="map-outline"
              size={18}
              color={theme.colors.accentMid}
            />
            <Text style={styles.actionLabel}>View on Map</Text>
          </TouchableOpacity>

          {isRide ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // Open ride on map and show save route option
                handleOpenRide(item.id);
              }}
            >
              <MaterialCommunityIcons
                name="content-save-outline"
                size={18}
                color={theme.colors.accentMid}
              />
              <Text style={styles.actionLabel}>Save Route</Text>
            </TouchableOpacity>
          ) : canShare ? (
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
          ) : null}
        </View>
      </View>
    );
  }

  const isLoading = viewMode === "routes" ? loadingRoutes : loadingRides;
  const displayData = viewMode === "routes" ? sortedRoutes : sortedRides;

  if (isLoading) {
    return (
      <CRScreen>
        <View style={styles.center}>
          <Text style={styles.subtle}>
            Loading {viewMode === "routes" ? "routes" : "rides"}…
          </Text>
        </View>
      </CRScreen>
    );
  }

  const emptyMessage =
    viewMode === "rides"
      ? "No saved rides yet"
      : filterBy === "shared"
      ? "No shared routes"
      : filterBy === "public"
      ? "No public routes"
      : filterBy === "private"
      ? "No private routes"
      : "No saved routes yet";

  return (
    <CRScreen padded={false}>
      <FlatList
        data={displayData}
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

  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  toggleButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  toggleButtonActive: {
    backgroundColor: "#42A5F5",
  },

  toggleButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },

  toggleButtonTextActive: {
    color: "#ffffff",
    fontWeight: "700",
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
    backgroundColor: "#42A5F5",
  },

  sortPillText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },

  sortPillTextActive: {
    color: "#ffffff",
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
    backgroundColor: theme.colors.surface,
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

import { CRButton } from "@core/components/ui/CRButton";
import { CRLabel } from "@core/components/ui/CRLabel";
import { CRScreen } from "@core/components/ui/CRScreen";
import { AuthContext } from "@core/context/AuthContext";
import { useTheme } from "@core/context/ThemeContext";
import { useAllUserGroups } from "@core/groups/hooks";
import { RIDE_VISIBILITY, shareRoute } from "@core/map/routes/sharedRides";
import { useSavedRides } from "@core/map/routes/useSavedRides";
import { useSavedRoutes } from "@core/map/routes/useSavedRoutes";
import { deleteRoute } from "@core/map/routes/deleteRoute";
import { recoverRoute } from "@core/map/routes/recoverRoute";
import { useWaypointsContext } from "@core/map/waypoints/WaypointsContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  { key: "deleted", label: "Recently Deleted" },
];

export default function SavedRoutesScreen() {
  const router = useRouter();
  const { setPendingSavedRouteId } = useWaypointsContext();
  const { user, capabilities } = useContext(AuthContext);
  const { groups } = useAllUserGroups(user?.uid);
  // Use dynamic theme from context for immediate updates
  const dynamicTheme = useTheme();
  const theme = dynamicTheme;

  // Helper to convert hex color to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Create theme-aware styles inside component so they update when theme changes
  const dynamicStyles = StyleSheet.create({
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
    toggleButtonText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    toggleButtonActive: {
      backgroundColor: theme.colors.accentMid,
    },
    toggleButtonTextActive: {
      color: theme.colors.primaryLight,
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
      backgroundColor: theme.colors.accentMid,
    },
    sortPillText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    sortPillTextActive: {
      color: theme.colors.primaryLight,
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
      backgroundColor: hexToRgba(theme.colors.accentMid, 0.15),
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
      backgroundColor: hexToRgba(theme.colors.accentMid, 0.1),
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
      backgroundColor: hexToRgba(theme.colors.accentMid, 0.15),
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
    confirmModal: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
      width: "80%",
    },
    confirmTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 8,
    },
    confirmMessage: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginBottom: 20,
      lineHeight: 20,
    },
  });

  const [viewMode, setViewMode] = useState("routes"); // 'routes' or 'rides'
  const [sortBy, setSortBy] = useState("created");
  const [filterBy, setFilterBy] = useState("all");
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [recoverConfirmVisible, setRecoverConfirmVisible] = useState(false);
  const [routeToRecover, setRouteToRecover] = useState(null);
  const [recovering, setRecovering] = useState(false);

  // Include public routes when viewing all or explicitly public
  const includePublic = filterBy === "all" || filterBy === "public";
  const includeDeleted = filterBy === "deleted";
  const { routes, loading: loadingRoutes } = useSavedRoutes(includePublic, includeDeleted);
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

  async function handleDeleteRoute() {
    if (!routeToDelete) return;
    setDeleting(true);
    try {
      await deleteRoute(routeToDelete);
      Alert.alert("Success", "Route deleted. You have 30 days to recover it.");
      setDeleteConfirmVisible(false);
      setRouteToDelete(null);
      // Re-fetch routes will happen automatically via hook
    } catch (error) {
      console.error("Error deleting route:", error);
      Alert.alert("Error", error.message || "Failed to delete route");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRecoverRoute() {
    if (!routeToRecover) return;
    setRecovering(true);
    try {
      await recoverRoute(routeToRecover);
      Alert.alert("Success", "Route recovered!");
      setRecoverConfirmVisible(false);
      setRouteToRecover(null);
      // Re-fetch routes will happen automatically via hook
    } catch (error) {
      console.error("Error recovering route:", error);
      Alert.alert("Error", error.message || "Failed to recover route");
    } finally {
      setRecovering(false);
    }
  }

  function confirmDeleteRoute(route) {
    setRouteToDelete(route.id);
    setDeleteConfirmVisible(true);
  }

  function confirmRecoverRoute(route) {
    setRouteToRecover(route.id);
    setRecoverConfirmVisible(true);
  }

  function renderHeader() {
    return (
      <View style={dynamicStyles.header}>
        {/* Routes/Rides Toggle */}
        <View style={dynamicStyles.toggleRow}>
          <TouchableOpacity
            onPress={() => setViewMode("routes")}
            style={[
              dynamicStyles.toggleButton,
              viewMode === "routes" && dynamicStyles.toggleButtonActive,
            ]}
          >
            <Text
              style={[
                dynamicStyles.toggleButtonText,
                viewMode === "routes" && dynamicStyles.toggleButtonTextActive,
              ]}
            >
              Routes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode("rides")}
            style={[
              dynamicStyles.toggleButton,
              viewMode === "rides" && dynamicStyles.toggleButtonActive,
            ]}
          >
            <Text
              style={[
                dynamicStyles.toggleButtonText,
                viewMode === "rides" && dynamicStyles.toggleButtonTextActive,
              ]}
            >
              Rides
            </Text>
          </TouchableOpacity>
        </View>

        {/* Only show sort/filter for routes view */}
        {viewMode === "routes" && (
          <>
            <Text style={dynamicStyles.headerLabel}>Sort by:</Text>
            <View style={dynamicStyles.sortRow}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSortBy(opt.key)}
                  style={[
                    dynamicStyles.sortPill,
                    sortBy === opt.key && dynamicStyles.sortPillActive,
                  ]}
                >
                  <Text
                    style={[
                      dynamicStyles.sortPillText,
                      sortBy === opt.key && dynamicStyles.sortPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={dynamicStyles.headerLabel}>Filter:</Text>
            <View style={dynamicStyles.sortRow}>
              {FILTER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setFilterBy(opt.key)}
                  style={[
                    dynamicStyles.sortPill,
                    filterBy === opt.key && dynamicStyles.sortPillActive,
                  ]}
                >
                  <Text
                    style={[
                      dynamicStyles.sortPillText,
                      filterBy === opt.key && dynamicStyles.sortPillTextActive,
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
      <View style={dynamicStyles.cardContainer}>
        <TouchableOpacity
          style={dynamicStyles.card}
          onPress={() => (isRide ? handleOpenRide(item.id) : handleOpenRoute(item.id))}
        >
          <View style={dynamicStyles.titleRow}>
            <Text style={dynamicStyles.title} numberOfLines={1}>
              {item.name ||
                item.title ||
                item.destination?.title ||
                "Untitled"}
            </Text>
            {!isRide && item.visibility === RIDE_VISIBILITY.PUBLIC && (
              <View style={dynamicStyles.badge}>
                <Ionicons name="globe" size={12} color={theme.colors.accentMid} />
                <Text style={dynamicStyles.badgeText}>Public</Text>
              </View>
            )}
            {!isRide && groupInfo && (
              <View style={dynamicStyles.badge}>
                <MaterialCommunityIcons name="account-multiple" size={12} color={theme.colors.accentMid} />
                <Text style={dynamicStyles.badgeText}>{groupInfo.name}</Text>
              </View>
            )}
            {!isRide && item.deleted && item.deletedAt && (
              <View style={[dynamicStyles.badge, { borderColor: theme.colors.error, backgroundColor: hexToRgba(theme.colors.error, 0.15) }]}>
                <MaterialCommunityIcons name="delete-outline" size={12} color={theme.colors.error} />
                <Text style={[dynamicStyles.badgeText, { color: theme.colors.error }]}>
                  {(() => {
                    const deletedTime = item.deletedAt.seconds * 1000;
                    const now = Date.now();
                    const daysLeft = Math.ceil((deletedTime + 30 * 24 * 60 * 60 * 1000 - now) / (24 * 60 * 60 * 1000));
                    return Math.max(0, daysLeft);
                  })()} days
                </Text>
              </View>
            )}
          </View>

          <View style={dynamicStyles.metaRow}>
            {item.distanceMeters != null && (
              <Text style={dynamicStyles.meta}>
                {(item.distanceMeters / 1609).toFixed(1)} mi
              </Text>
            )}

            {item.durationSeconds != null && (
              <Text style={dynamicStyles.meta}>
                · {Math.floor(item.durationSeconds / 60)} mins
              </Text>
            )}

            {!isRide && item.waypoints?.length != null && (
              <Text style={dynamicStyles.meta}>
                · {item.waypoints.length} stops
              </Text>
            )}

            {!isRide && item.ratingAvg != null && (
              <Text style={dynamicStyles.meta}>
                · ★ {item.ratingAvg.toFixed(1)}
              </Text>
            )}
          </View>

          {isRide && item.completedAt?.seconds ? (
            <Text style={dynamicStyles.subtle}>
              Completed{" "}
              {new Date(item.completedAt.seconds * 1000).toLocaleDateString()}
            </Text>
          ) : !isRide && item.createdAt?.seconds ? (
            <Text style={dynamicStyles.subtle}>
              Created{" "}
              {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
            </Text>
          ) : null}
        </TouchableOpacity>

        <View style={dynamicStyles.actionRow}>
          <TouchableOpacity
            style={dynamicStyles.actionButton}
            onPress={() => (isRide ? handleOpenRide(item.id) : handleOpenRoute(item.id))}
          >
            <Ionicons
              name="map-outline"
              size={18}
              color={theme.colors.accentMid}
            />
            <Text style={dynamicStyles.actionLabel}>View on Map</Text>
          </TouchableOpacity>

          {isRide ? (
            <TouchableOpacity
              style={dynamicStyles.actionButton}
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
              <Text style={dynamicStyles.actionLabel}>Save Route</Text>
            </TouchableOpacity>
          ) : item.deleted ? (
            <TouchableOpacity
              style={dynamicStyles.actionButton}
              onPress={() => confirmRecoverRoute(item)}
            >
              <MaterialCommunityIcons
                name="restore"
                size={18}
                color={theme.colors.success}
              />
              <Text style={dynamicStyles.actionLabel}>Recover</Text>
            </TouchableOpacity>
          ) : (
            <>
              {canShare && (
                <TouchableOpacity
                  style={dynamicStyles.actionButton}
                  onPress={() => openShareModal(item)}
                >
                  <MaterialCommunityIcons
                    name="share-variant"
                    size={18}
                    color={theme.colors.accentMid}
                  />
                  <Text style={dynamicStyles.actionLabel}>Share</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={dynamicStyles.actionButton}
                onPress={() => confirmDeleteRoute(item)}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={18}
                  color={theme.colors.error}
                />
                <Text style={dynamicStyles.actionLabel}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  const isLoading = viewMode === "routes" ? loadingRoutes : loadingRides;
  const displayData = viewMode === "routes" ? sortedRoutes : sortedRides;

  if (isLoading) {
    return (
      <CRScreen>
        <View style={dynamicStyles.center}>
          <Text style={dynamicStyles.subtle}>
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
          <View style={dynamicStyles.center}>
            <MaterialCommunityIcons
              name="map-marker-path"
              size={48}
              color={theme.colors.textMuted}
            />
            <Text style={dynamicStyles.subtle}>{emptyMessage}</Text>
          </View>
        }
        stickyHeaderIndices={[0]}
        contentContainerStyle={dynamicStyles.list}
      />

      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Share Route</Text>
            <Text style={dynamicStyles.modalSubtitle}>
              {selectedRoute?.name || "Untitled route"}
            </Text>

            <ScrollView style={dynamicStyles.optionsContainer}>
              <CRLabel text="Visibility" />

              {/* Private Option */}
              <TouchableOpacity
                style={[
                  dynamicStyles.visibilityOption,
                  selectedVisibility === RIDE_VISIBILITY.PRIVATE &&
                    dynamicStyles.visibilityOptionSelected,
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
                <View style={dynamicStyles.optionTextContainer}>
                  <Text style={dynamicStyles.optionTitle}>Private</Text>
                  <Text style={dynamicStyles.optionDesc}>Only you can see this</Text>
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
                  dynamicStyles.visibilityOption,
                  selectedVisibility === RIDE_VISIBILITY.GROUP &&
                    dynamicStyles.visibilityOptionSelected,
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
                <View style={dynamicStyles.optionTextContainer}>
                  <Text style={dynamicStyles.optionTitle}>Group</Text>
                  <Text style={dynamicStyles.optionDesc}>Share with a group</Text>
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
                <View style={dynamicStyles.groupSelector}>
                  {groups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        dynamicStyles.groupOption,
                        selectedGroupId === group.id &&
                          dynamicStyles.groupOptionSelected,
                      ]}
                      onPress={() => setSelectedGroupId(group.id)}
                    >
                      <Text
                        style={[
                          dynamicStyles.groupOptionText,
                          selectedGroupId === group.id &&
                            dynamicStyles.groupOptionTextSelected,
                        ]}
                      >
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedVisibility === RIDE_VISIBILITY.GROUP && (!groups || groups.length === 0) && (
                <Text style={dynamicStyles.noGroupsText}>
                  No groups available. Create a group first.
                </Text>
              )}

              {/* Public Option */}
              <TouchableOpacity
                style={[
                  dynamicStyles.visibilityOption,
                  selectedVisibility === RIDE_VISIBILITY.PUBLIC &&
                    dynamicStyles.visibilityOptionSelected,
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
                <View style={dynamicStyles.optionTextContainer}>
                  <Text style={dynamicStyles.optionTitle}>Public</Text>
                  <Text style={dynamicStyles.optionDesc}>Anyone can see this</Text>
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

            <View style={dynamicStyles.buttonRow}>
              <CRButton
                onPress={handleShareRoute}
                title="Share"
                loading={sharing}
                style={dynamicStyles.modalButton}
              />
              <CRButton
                onPress={() => setShareModalVisible(false)}
                title="Cancel"
                style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                textStyle={dynamicStyles.cancelButtonText}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteConfirmVisible(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.confirmModal}>
            <Text style={dynamicStyles.confirmTitle}>Delete Route?</Text>
            <Text style={dynamicStyles.confirmMessage}>
              This route will be deleted. You have 30 days to recover it.
            </Text>
            <View style={dynamicStyles.buttonRow}>
              <CRButton
                onPress={handleDeleteRoute}
                title="Delete"
                loading={deleting}
                style={[dynamicStyles.modalButton, { backgroundColor: theme.colors.error }]}
              />
              <CRButton
                onPress={() => !deleting && setDeleteConfirmVisible(false)}
                title="Cancel"
                style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                textStyle={dynamicStyles.cancelButtonText}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Recover Confirmation Modal */}
      <Modal
        visible={recoverConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !recovering && setRecoverConfirmVisible(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.confirmModal}>
            <Text style={dynamicStyles.confirmTitle}>Recover Route?</Text>
            <Text style={dynamicStyles.confirmMessage}>
              This route will be restored and visible again.
            </Text>
            <View style={dynamicStyles.buttonRow}>
              <CRButton
                onPress={handleRecoverRoute}
                title="Recover"
                loading={recovering}
                style={[dynamicStyles.modalButton, { backgroundColor: theme.colors.success }]}
              />
              <CRButton
                onPress={() => !recovering && setRecoverConfirmVisible(false)}
                title="Cancel"
                style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                textStyle={dynamicStyles.cancelButtonText}
              />
            </View>
          </View>
        </View>
      </Modal>
    </CRScreen>
  );
}


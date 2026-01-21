import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import useWaypoints from "./useWaypoints";

// IMPORTANT:
// This component is display-first.
// It receives `waypoints` as a prop (which may include destination).
// It may still call useWaypoints() ONLY for mutations during transition.

export default function WaypointsList({ waypoints, onClearAll, routeOrigin, routedTotalMeters }) {
  // ⚠️ DO NOT destructure `waypoints` from context here
  const [collapsed, setCollapsed] = useState(true);
  const reorderableWaypoints = waypoints.filter(wp => !wp.isTerminal);
  const destination = waypoints.find(wp => wp.isTerminal);
  const {
    removeWaypoint,
    reorderWaypoints, // ✅ MUST be destructured
  } = useWaypoints();

  function formatDistanceImperial(meters) {
    if (meters == null) return "";
    const miles = meters / 1609.344;
    if (miles >= 0.1) {
      const digits = miles >= 10 ? 0 : 1;
      return `${miles.toFixed(digits)} mi`;
    }
    const yards = meters * 1.09361;
    return `${Math.round(yards)} yd`;
  }

  if (!waypoints?.length) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setCollapsed(c => !c)}
        style={styles.header}
      >
        <Text style={styles.title}>
          Waypoints ({waypoints.length})
        </Text>
        <MaterialCommunityIcons
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={22}
          color={theme.colors.accentMid}
        />
      </TouchableOpacity>

      <TouchableOpacity onPress={onClearAll}>
        <Text style={styles.clear}>Clear route</Text>
      </TouchableOpacity>

      {!collapsed && (
        <DraggableFlatList
          data={reorderableWaypoints}
          keyExtractor={(item, index) =>
            `${item.latitude}-${item.longitude}-${index}`
          }
          onDragEnd={({ from, to }) => {
            if (from !== to) reorderWaypoints(from, to);
          }}
          renderItem={({ item, drag, isActive, getIndex }) => {
            const index = getIndex();
            return (
              <View
                style={[styles.row, isActive && { opacity: 0.7 }]}
              >
                <Text style={styles.index}>{index + 1}</Text>
                <Text style={styles.label} numberOfLines={1}>
                  {item.title || "Dropped pin"}
                </Text>
                {/* Remove button */}
                <TouchableOpacity
                  onPress={() => removeWaypoint(index)}
                  hitSlop={12}
                  style={{ paddingHorizontal: 8 }}
                >
                  <Text style={styles.remove}>✕</Text>
                </TouchableOpacity>
                {/* Drag handle */}
                <TouchableOpacity
                  onLongPress={drag}
                  hitSlop={12}
                  style={{ paddingHorizontal: 8 }}
                >
                  <MaterialCommunityIcons
                    name="drag"
                    size={24}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
      {/* Show only routed total at the destination row if present */}
      {destination && routeOrigin && (
        <View style={[styles.row, styles.destinationRow]}>
          <Text style={styles.index}>{reorderableWaypoints.length + 1}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {destination.title}
          </Text>
          {typeof routedTotalMeters === 'number' && routedTotalMeters > 0 && (
            <Text style={styles.distance}>
              {`${formatDistanceImperial(routedTotalMeters)} routed`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 12,
    right: 12,
    backgroundColor: theme.colors.surfaceOverlay || "rgba(15,23,42,0.9)",
    borderRadius: 14,
    padding: 10,
    zIndex: 2500,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    color: theme.colors.accent,
    fontWeight: "600",
    fontSize: 14,
  },
  clear: {
    color: theme.colors.accentMid,
    fontSize: 12,
    marginBottom: 4,
  },
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  destinationRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  index: {
    width: 20,
    color: theme.colors.accentMid,
    fontSize: 12,
  },
  label: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    marginRight: 8,
  },
  remove: {
    color: theme.colors.danger,
    fontSize: 20,
    fontWeight: "600",
  },
  distance: {
    color: theme.colors.accentMid,
    fontSize: 12,
    marginLeft: 8,
    minWidth: 48,
    textAlign: "right",
  },
});

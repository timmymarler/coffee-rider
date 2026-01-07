import theme from "@themes";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import useWaypoints from "./useWaypoints";

export default function WaypointsList({ onClearAll }) {
  const { waypoints, removeWaypoint, clearWaypoints } = useWaypoints();

  if (!waypoints.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Waypoints</Text>
          <TouchableOpacity onPress={onClearAll}>
          <Text style={styles.clear}>Clear</Text>
        </TouchableOpacity>
      </View>

      {waypoints.map((wp, index) => (
        <View key={`${wp.lat}-${wp.lng}-${index}`} style={styles.row}>
          <Text style={styles.index}>{index + 1}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {wp.title}
          </Text>
          <TouchableOpacity onPress={() => removeWaypoint(index)}>
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 12,
    right: 26,
    backgroundColor: theme.colors.surfaceOverlay || "rgba(15,23,42,0.9)",
    borderRadius: 14,
    padding: 10,
    zIndex: 2500,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  index: {
    width: 20,
    color: theme.colors.accentMid,
    fontSize: 12,
  },
  label: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    marginRight: 8,
  },
  remove: {
    color: theme.colors.danger,
    fontSize: 14,
    paddingHorizontal: 6,
  },
});

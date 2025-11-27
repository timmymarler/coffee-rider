import { theme } from "@/config/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function FilterPanel({ filters, onToggle, onClose }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Filters</Text>

      {/* BIKE */}
      <Pressable
        style={styles.row}
        onPress={() => onToggle("bike")}
      >
        <Ionicons
          name={filters.bike ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={filters.bike ? theme.colors.primaryLight : "#666"}
        />
        <Text style={styles.label}>Bike</Text>
      </Pressable>

      {/* SCOOTERS */}
      <Pressable
        style={styles.row}
        onPress={() => onToggle("scooters")}
      >
        <Ionicons
          name={filters.scooters ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={filters.scooters ? theme.colors.primaryLight : "#666"}
        />
        <Text style={styles.label}>Scooters</Text>
      </Pressable>

      {/* PARKING */}
      <Pressable
        style={styles.row}
        onPress={() => onToggle("parking")}
      >
        <Ionicons
          name={filters.parking ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={filters.parking ? theme.colors.primaryLight : "#666"}
        />
        <Text style={styles.label}>Parking</Text>
      </Pressable>

      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 80,
    left: 15,
    right: 15,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    zIndex: 9999,
  },

  heading: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  label: {
    fontSize: 16,
    marginLeft: 12,
    color: "#333",
  },

  closeBtn: {
    marginTop: 14,
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },

  closeText: {
    color: "#fff",
    fontWeight: "600",
  },
});

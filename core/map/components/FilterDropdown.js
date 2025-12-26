import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import {
    TouchableOpacity,
    View
} from "react-native";

export default function FilterDropdown({
  filters = [],
  onToggle,
  onClose,
}) {
  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={styles.panel}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.iconButton,
              filter.enabled && styles.iconButtonActive,
            ]}
            onPress={() => onToggle(filter.key)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={filter.icon}
              size={22}
              color={
                filter.enabled
                  ? theme.colors.accentMid
                  : theme.colors.textMuted
              }
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    inset: 0,
    zIndex: 30,
  },

  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  panel: {
    position: "absolute",
    top: 92,
    right: 12,
    flexDirection: "row",
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 14,
    padding: 8,
    elevation: 10,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },

  iconButtonActive: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});

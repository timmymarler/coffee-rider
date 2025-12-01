// core/map/components/NavigateButton.js
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@theme/index";
import { Pressable, StyleSheet } from "react-native";

export function NavigateButton({ onPress, icon = "navigate-outline", style }) {
  if (!onPress) return null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, style]}
      hitSlop={10}
    >
      <Ionicons name={icon} size={24} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent || "#C99A3D",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
});

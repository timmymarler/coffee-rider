// core/map/components/RecenterButton.js
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity } from "react-native";

export function RecenterButton({ onPress, theme }) {
  const styles = createStyles(theme);

  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Ionicons name="locate" size={22} color={theme.colors.accent} />
    </TouchableOpacity>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    button: {
      position: "absolute",
      bottom: 100,
      right: 20,
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.tabBackground,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
}

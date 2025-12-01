// core/components/ui/Button.js

import { getTheme } from "@themes";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";

export function PrimaryButton({ label, onPress, loading, disabled, style }) {
  const theme = getTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      style={[
        styles(theme).button,
        disabled ? styles(theme).disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.buttonText} />
      ) : (
        <Text style={styles(theme).label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = (theme) =>
  StyleSheet.create({
    button: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    label: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    disabled: {
      backgroundColor: theme.colors.buttonBackgroundDisabled,
      opacity: 0.7,
    },
  });

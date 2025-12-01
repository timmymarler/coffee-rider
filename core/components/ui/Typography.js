// core/components/ui/Typography.js

import { getTheme } from "@themes";
import { StyleSheet, Text } from "react-native";

export function H1({ children, style }) {
  const theme = getTheme();
  return (
    <Text style={[styles(theme).h1, style]}>
      {children}
    </Text>
  );
}

export function H3({ children, style }) {
  const theme = getTheme();
  return (
    <Text style={[styles(theme).h3, style]}>
      {children}
    </Text>
  );
}

const styles = (theme) =>
  StyleSheet.create({
    h1: {
      fontSize: 32,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    h3: {
      fontSize: 16,
      color: theme.colors.textMuted,
      marginBottom: 12,
    }
  });

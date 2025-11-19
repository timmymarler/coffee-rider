import { StyleSheet, Text } from "react-native";
import { theme } from "../../config/theme";

export function H1({ children, style, ...props }) {
  return (
    <Text style={[styles.h1, style]} {...props}>
      {children}
    </Text>
  );
}

export function H2({ children, style, ...props }) {
  return (
    <Text style={[styles.h2, style]} {...props}>
      {children}
    </Text>
  );
}

export function H3({ children, style, ...props }) {
  return (
    <Text style={[styles.h3, style]} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, style, ...props }) {
  return (
    <Text style={[styles.body, style]} {...props}>
      {children}
    </Text>
  );
}

export function Caption({ children, style, ...props }) {
  return (
    <Text style={[styles.caption, style]} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: "700",
    color: theme.colors.text,
    textShadowColor: "rgba(8, 12, 16, 0.32)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  h2: {
    fontSize: 24,
    fontWeight: "600",
    color: theme.colors.text,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  body: {
    fontSize: 15,
    color: theme.colors.text,
  },
  caption: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
});

import { theme } from "@config/theme";
import { StyleSheet, Text } from "react-native";

export function LinkText({ children, style, ...props }) {
  return (
    <Text style={[styles.link, style]} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 16,
    color: theme.colors.accent,   // brighter + clearer
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
});

import { theme } from "@theme/index";
import { StyleSheet, Text } from "react-native";

export function TextLink({ children, style, ...props }) {
  return (
    <Text style={[styles.link, style]} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 16,
    color: theme.colors.accent,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
});

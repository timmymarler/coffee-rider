// core/components/ui/CRAlert.js

import { getTheme } from "@themes";
import { StyleSheet, Text, View } from "react-native";

export default function CRAlert({
  children,
  variant = "success", // "success" | "error" | "warning"
  style,
  textStyle,
}) {
  const theme = getTheme();
  const { tokens } = theme;
  const { components, typography } = tokens;

  let cfg;
  switch (variant) {
    case "error":
      cfg = components.alertError;
      break;
    case "warning":
      cfg = components.alertWarning;
      break;
    default:
      cfg = components.alertSuccess;
  }

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: cfg.background,
          padding: cfg.padding,
          borderRadius: cfg.radius,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.body,
          {
            color: cfg.textColor,
          },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
  },
});

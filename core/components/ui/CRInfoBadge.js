// core/components/ui/CRInfoBadge.js

import theme from "@themes";
import { Text, View } from "react-native";

export function CRInfoBadge({
  label,
  variant = "danger", // "success" | "accent" | "danger"
  style,
  textStyle,
  icon = null,
}) {

  // Variant colours
  const variantMap = {
    info: {
      bg: theme.colors.primaryLight,
      text: theme.colors.textPrimary,
    },
    success: {
      bg: theme.colors.success,
      text: "#FFF",
    },
    warning: {
      bg: theme.colors.warning,
      text: "#000",
    },
    danger: {
      bg: theme.colors.error,
      text: "#FFF",
    },
  };

  const badgeTheme = theme.colors[variant];

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: badgeTheme.accentMid,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.sm,
        },
        style,
      ]}
    >
      {icon && <View style={{ marginRight: theme.spacing.xs }}>{icon}</View>}

      <Text
        style={[
          {
            color: theme.colors.text,
            fontSize: theme.typography.sm,
            fontWeight: "600",
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// core/components/ui/CRButton.js

import theme from "@themes";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";

export function CRButton({
  title,
  onPress,
  variant = "accentMid", // "primary" | "accentMid" | "accentDark" | "danger"
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
}) {

  // Determine colors based on variant
  let buttonColor, textColor;
  
  if (variant === "danger") {
    buttonColor = theme.colors.danger;
    textColor = "#ffffff";
  } else if (variant === "accentDark") {
    buttonColor = theme.colors.accentDark;
    textColor = theme.colors.primaryDark;
  } else if (variant === "accentMid") {
    buttonColor = theme.colors.accentMid;
    textColor = theme.colors.primaryMid;
  } else {
    // Fallback for "primary" or any other variant
    buttonColor = theme.colors[variant] || theme.colors.accentMid;
    textColor = theme.colors.primaryDark;
  }

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        {
          width: fullWidth ? "100%" : undefined,
          backgroundColor: isDisabled ? theme.colors.accentDark : buttonColor,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.lg,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "danger" ? "#ffffff" : theme.colors.primaryDark} />
      ) : (
        <Text
          style={[
            {
              color: isDisabled ? theme.colors.primaryDark : textColor,
              fontSize: theme.typography.md,
              fontWeight: "600",
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

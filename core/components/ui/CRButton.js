// core/components/ui/CRButton.js

import theme from "@themes";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";

export function CRButton({
  title,
  onPress,
  variant = "accent", // "primary" | "accent" | "danger"
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
}) {

  const buttonColor = theme.colors[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        {
          width: fullWidth ? "100%" : undefined,
          backgroundColor: isDisabled ? `${buttonColor}66` : buttonColor,
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
              color: variant === "danger" ? "#ffffff" : theme.colors.primaryDark,
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

// core/components/ui/CRLabel.js

import theme from "@themes";
import { Text } from "react-native";

export function CRLabel({
  children,
  upper = false,
  style,
}) {

  return (
    <Text
      style={[
        {
          color: theme.colors.accentDark,           // accentMid gold
          fontSize: theme.typography.sm,        // small typography token
          fontWeight: "600",
          marginBottom: theme.spacing.xs,
          textTransform: upper ? "uppercase" : "none",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

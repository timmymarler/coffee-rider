// core/components/ui/CRCard.js

import theme from "@themes";
import { View } from "react-native";

export function CRCard({ children, style }) {

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.primaryDark,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
          width: "100%",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

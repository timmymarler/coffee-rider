// core/components/ui/CRDivider.js

import { getTheme } from "@themes";
import { StyleSheet, View } from "react-native";

export default function CRDivider({ style }) {
  const theme = getTheme();
  const { tokens } = theme;
  const { components, spacing } = tokens;

  const cfg = components.divider;

  return (
    <View
      style={[
        styles.base,
        {
          height: cfg.thickness,
          backgroundColor: cfg.color,
          marginVertical: cfg.marginY ?? spacing.sm,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
  },
});

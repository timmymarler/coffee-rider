// core/map/components/MapLayout.js
import { theme } from "@theme/index";
import { StyleSheet, View } from "react-native";

export function MapLayout({ children }) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background || "#05060A",
  },
});

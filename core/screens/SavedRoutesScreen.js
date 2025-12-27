import theme from "@themes";
import { Text, View } from "react-native";

export default function SavedRoutesScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.colors.textMuted }}>
        Saved routes coming soon.
      </Text>
    </View>
  );
}

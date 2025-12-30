import theme from "@themes";
import { Text, View } from "react-native";

export default function GroupsScreen() {
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
        Groups coming soon.
      </Text>
    </View>
  );
}

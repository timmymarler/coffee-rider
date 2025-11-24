import { Stack } from "expo-router";
import { Text, View } from "react-native";

export default function SavedRouteScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text>Saved Routes Screen Placeholder</Text>
    </View>
  );
}

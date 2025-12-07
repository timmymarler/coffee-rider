import { Stack } from "expo-router";
import { Text, View } from "react-native";

export default function AddVenueScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text>Add Venue Screen Placeholder</Text>
    </View>
  );
}

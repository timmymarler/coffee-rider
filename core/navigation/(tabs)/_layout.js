import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="map" />
      <Tabs.Screen name="add-cafe" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="routes" />
    </Tabs>
  );
}

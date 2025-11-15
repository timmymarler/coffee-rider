// app/(tabs)/_layout.js
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { can, loading } = useAuth();

  if (loading) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007aff",
        tabBarInactiveTintColor: "#555",

        tabBarStyle: {
          justifyContent: "flex-end",
        },

        tabBarItemStyle: {
          flex: 0,
        },
      }}
    >
      {/* ALWAYS: MAP */}
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ROUTES: tab button hidden if not allowed */}
      <Tabs.Screen
        name="hidden/routes"
        options={{
          title: "Routes",
          // If user cannot view routes, remove the tab button
          tabBarButton: can.viewRoutes ? undefined : () => null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="navigate-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ADD-CAFE: tab button hidden if not allowed */}
      <Tabs.Screen
        name="hidden/add-cafe"
        options={{
          title: "Add Café",
          // If user cannot add cafés, remove the tab button
          tabBarButton: can.addCafe ? undefined : () => null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="add-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ALWAYS: PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { theme } from "../../config/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7FA6C8",        // new crisp blue
        tabBarInactiveTintColor: theme.colors.primaryLight, // your muted blue
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={40}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarStyle: {
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 20,
          elevation: 5,
          height: 60,
          borderRadius: 25,
          borderTopWidth: 0,
          overflow: "hidden",
          paddingBottom: 6,
          paddingTop: 6,

          // iOS shadow
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 10,

          // Android shadow
          backgroundColor: Platform.OS === "android"
            ? "rgba(14,18,23,0.85)"  // your charcoal/blue with transparency
            : "transparent",
        },
      }}
    >

      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name="map"
              size={focused ? size + 2 : size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="routes"
        options={{
          title: "Routes",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name="navigate"
              size={focused ? size + 2 : size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="favourites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name="heart"
              size={focused ? size + 2 : size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name="person"
              size={focused ? size + 2 : size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

    </Tabs>
);
}

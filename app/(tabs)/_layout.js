import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { useAuth } from "../../context/AuthContext";
import { View, TouchableOpacity } from "react-native";
import { useFonts } from "expo-font";

export default function TabsLayout() {
  const { user } = useAuth(); // ✅ get user here
  return (
    <>
      <AppHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#007aff",
        }}
      >
        <Tabs.Screen
          name="map"
          options={{
            title: "Map",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map-outline" color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="add-cafe"
          options={{
            title: "Add Café",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle-outline" color={color} size={size} />
            ),
            tabBarStyle: {},

            // ✅ Disable the tab when not logged in
            tabBarButton: (props) => (
	    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <TouchableOpacity
                {...props}
                disabled={!user}
                style={{ opacity: user ? 1 : 0.4 }}
              />
	    </View>
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

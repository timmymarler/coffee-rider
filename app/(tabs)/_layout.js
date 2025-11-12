import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { user, can } = useAuth();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#6b4f1d",
        tabBarInactiveTintColor: "#999",
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "map") iconName = "map";
          else if (route.name === "add-cafe") iconName = "add-circle";
          else if (route.name === "profile") iconName = "person-circle";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* Map tab always visible */}
      <Tabs.Screen name="map" options={{ title: "Map" }} />

      {/* Add Café tab only visible to allowed roles */}
      {can?.addCafe ? (
        <Tabs.Screen name="add-cafe" options={{ title: "Add Café" }} />
      ) : (
        <Tabs.Screen
          name="add-cafe"
          options={{
            // This hides it completely without breaking Expo Router
            tabBarButton: () => null,
          }}
        />
      )}

      {/* Profile/Login tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: user ? "Profile" : "Login",
        }}
      />
    </Tabs>
  );
}

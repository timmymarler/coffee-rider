import { TabBarContext, TabBarProvider } from "@context/TabBarContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useContext, useEffect, useRef } from "react";
import { Animated, TouchableOpacity } from "react-native";

function FloatingTabBar({ state }) {
  const router = useRouter();
  const { hidden } = useContext(TabBarContext);

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hidden ? 100 : 0, // slide down/up
      duration: 220,
      useNativeDriver: true
    }).start();
  }, [hidden, translateY]);

  const tabs = [
    { name: "map", icon: "navigate" },
    { name: "saved-routes", icon: "list" },
    { name: "add-cafe", icon: "cafe" },
    { name: "profile", icon: "person" }
  ];

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: "absolute",
        bottom: 28,
        left: 20,
        right: 20,
        height: 70,
        backgroundColor: "#ffffff",
        borderRadius: 40,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingHorizontal: 18,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10
      }}
    >
      {tabs.map((tab, index) => {
        const isFocused = state.index === index;

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => router.push(tab.name)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 8
            }}
          >
            <Ionicons
              name={isFocused ? tab.icon : `${tab.icon}-outline`}
              size={28}
              color={isFocused ? "#c46b00" : "#444"}
            />
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

export default function Layout() {
  return (
    <TabBarProvider>
      <Tabs
        screenOptions={{
          headerShown: false
        }}
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <Tabs.Screen name="map" />
        <Tabs.Screen name="saved-routes" />
        <Tabs.Screen name="add-cafe" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </TabBarProvider>
  );
}

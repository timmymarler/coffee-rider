// app/_layout.js

import AuthProvider from "@context/AuthContext";
import { TabBarContext, TabBarProvider } from "@context/TabBarContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useContext, useEffect, useRef } from "react";
import { Animated, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTheme } from "@themes";

function FloatingTabBar({ state }) {
  const router = useRouter();
  const theme = getTheme(); // NEW THEME SYSTEM
  const { hidden } = useContext(TabBarContext);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hidden ? 100 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [hidden]);

  const activeColor = theme.colors.accentDark;
  const inactiveColor = theme.colors.tabBarInactive;

  const tabs = [
    { name: "map", icon: "map" },
    { name: "saved-routes", icon: "git-branch" },
    { name: "profile", icon: "person" },
  ];

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: "absolute",
        left: 15,
        right: 15,
        bottom: insets.bottom,
        height: 40,
        backgroundColor: theme.colors.card,
        borderRadius: 20,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingHorizontal: 18,
        shadowColor: theme.colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      }}
    >
      {tabs.map((tab, index) => {
        const isFocused = state.index === index;
        const color = isFocused ? activeColor : inactiveColor;

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => router.push(tab.name)}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 3,
            }}
          >
            <Ionicons
              name={isFocused ? tab.icon : `${tab.icon}-outline`}
              size={28}
              color={color}
            />
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <TabBarProvider>
          <Tabs
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <FloatingTabBar {...props} />}
          >
            <Tabs.Screen name="map" />
            <Tabs.Screen name="saved-routes" />
            <Tabs.Screen name="profile" />
          </Tabs>
        </TabBarProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

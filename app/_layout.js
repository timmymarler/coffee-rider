// app/_layout.js

import AuthProvider from "@context/AuthContext";
import { TabBarContext, TabBarProvider } from "@context/TabBarContext";
import AppHeader from "@core/components/layout/AppHeader";
import VersionGate from "@core/components/VersionGate";
import { WaypointsProvider } from "@core/map/waypoints/WaypointsContext";
import { checkAppVersion } from "@core/utils/versionCheck";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function FloatingTabBar({ state }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const { hidden, mapActions } = useContext(TabBarContext);
  const pathname = usePathname();

  const isMapScreen =
    pathname === "/map" ||
    pathname.startsWith("/map/");

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hidden ? 100 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [hidden]);

  const activeColor = theme.colors.accentDark;
  const inactiveColor = theme.colors.primaryLight;

  const tabs = [
    { name: "map", icon: "map" },
    { name: "saved-routes", icon: "git-branch" },
    { name: "groups", icon: "people" },
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
        backgroundColor: theme.colors.primaryDark,
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

      {isMapScreen && (
        <>
          <View
            style={{
              width: 1,
              height: 22,
              backgroundColor: theme.colors.primaryLight,
              opacity: 0.4,
              marginHorizontal: 8,
            }}
          />

          <TouchableOpacity
            onPress={() => mapActions?.recenter()}
            style={{ paddingHorizontal: 6 }}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={22}
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => mapActions?.toggleFollow()}
            style={{ paddingHorizontal: 6 }}
          >
            <MaterialCommunityIcons
              name={"navigation-variant"}
              size={22}
              color={
                mapActions?.isFollowing()
                  ? theme.colors.danger
                  : theme.colors.primary
              }
            />
          </TouchableOpacity>
        </>
      )}

      {!isMapScreen && (
        <>
          <View
            style={{
              width: 1,
              height: 22,
              backgroundColor: theme.colors.primaryLight,
              opacity: 0.4,
              marginHorizontal: 8,
            }}
          />

          <TouchableOpacity style={{ paddingHorizontal: 6 }}>
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={22}
              color={theme.colors.primaryMid}
            />
          </TouchableOpacity>

          <TouchableOpacity style={{ paddingHorizontal: 6 }}>
            <MaterialCommunityIcons
              name={"navigation-variant"}
              size={22}
              color={theme.colors.primaryMid}
            />
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );
}

export default function Layout() {
  const [versionGate, setVersionGate] = useState(null);

  useEffect(() => {
    async function run() {
      const res = await checkAppVersion();
      if (!res) return;

      if (res.compareMin < 0 || res.forceUpdate) {
        setVersionGate({ forced: true });
      } else if (res.compareLatest < 0) {
        setVersionGate({ forced: false });
      }
    }

    run();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <TabBarProvider>
          <WaypointsProvider>
            <AppHeader />

            <Tabs
              screenOptions={{ headerShown: false }}
              tabBar={(props) => <FloatingTabBar {...props} />}
            >
              <Tabs.Screen name="map" />
              <Tabs.Screen name="saved-routes" />
              <Tabs.Screen name="groups" />
              <Tabs.Screen name="profile" />
            </Tabs>

            <VersionGate
              visible={!!versionGate}
              forced={versionGate?.forced}
              onClose={() => setVersionGate(null)}
            />

          </WaypointsProvider>
        </TabBarProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
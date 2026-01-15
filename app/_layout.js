// app/_layout.js

import AuthProvider, { AuthContext } from "@context/AuthContext";
import { TabBarContext, TabBarProvider } from "@context/TabBarContext";
import AppHeader from "@core/components/layout/AppHeader";
import { WaypointsProvider } from "@core/map/waypoints/WaypointsContext";
import { VersionUpgradeModal } from "@core/components/ui/VersionUpgradeModal";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { Animated, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";


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
          {/* separator */}
          <View
            style={{
              width: 1,
              height: 22,
              backgroundColor: theme.colors.primaryLight,
              opacity: 0.4,
              marginHorizontal: 8,
            }}
          />

          {/* Re-centre */}
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

          {/* Follow Me */}
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
          {/* separator */}
          <View
            style={{
              width: 1,
              height: 22,
              backgroundColor: theme.colors.primaryLight,
              opacity: 0.4,
              marginHorizontal: 8,
            }}
          />

          {/* Re-centre */}
          <TouchableOpacity
            style={{ paddingHorizontal: 6 }}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={22}
              color={theme.colors.primaryMid}
            />
          </TouchableOpacity>

          {/* Follow Me */}
          <TouchableOpacity
            style={{ paddingHorizontal: 6 }}
          >
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



function LayoutContent() {
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionModalDismissed, setVersionModalDismissed] = useState(false);
  const { versionStatus } = useContext(AuthContext);

  // Show version modal when status changes and update is available
  useEffect(() => {
    if (versionStatus?.hasUpdate && !versionModalDismissed) {
      if (versionStatus.isRequired) {
        setShowVersionModal(true);
      } else if (!versionModalDismissed) {
        setShowVersionModal(true);
      }
    }
  }, [versionStatus, versionModalDismissed]);

  const handleDismissVersion = () => {
    setShowVersionModal(false);
    setVersionModalDismissed(true);
  };

  const currentVersion = Constants.expoConfig?.version || "1.0.0";

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <Tabs.Screen name="map" />
        <Tabs.Screen name="saved-routes" />
        <Tabs.Screen name="groups" />
        <Tabs.Screen name="profile" />
      </Tabs>

      {versionStatus?.hasUpdate && (
        <VersionUpgradeModal
          visible={showVersionModal}
          isRequired={versionStatus.isRequired}
          currentVersion={currentVersion}
          newVersion={versionStatus.versionInfo?.latestVersion || "unknown"}
          releaseNotes={versionStatus.versionInfo?.releaseNotes}
          onDismiss={handleDismissVersion}
          storeUrl={
            Constants.expoConfig?.extra?.storeUrl ||
            "https://play.google.com/store/apps/details?id=com.timmy.marler.coffeerider"
          }
        />
      )}
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <TabBarProvider>
          <WaypointsProvider>
            <AppHeader />
            <LayoutContent />
          </WaypointsProvider>
        </TabBarProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

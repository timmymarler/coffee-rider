// app/_layout.js

import AuthProvider, { AuthContext } from "@context/AuthContext";
import { TabBarContext, TabBarProvider } from "@context/TabBarContext";
import AppHeader from "@core/components/layout/AppHeader";
import SplashScreen from "@core/components/ui/SplashScreen";
import { VersionUpgradeModal } from "@core/components/ui/VersionUpgradeModal";
import { WaypointsProvider } from "@core/map/waypoints/WaypointsContext";
import { getAndResetSummary } from "@core/utils/devMetrics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import theme from "@themes";
import Constants from "expo-constants";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { Alert, Animated, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView, LongPressGestureHandler } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";


function FloatingTabBar({ state }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const { hidden, mapActions, activeRide } = useContext(TabBarContext);
  const { capabilities, user } = useContext(AuthContext) || {};
  const pathname = usePathname();

  // Get endRide from map actions context - the map screen will provide it
  const endRide = useContext(TabBarContext).mapActions?.endRide;

  console.log('[FloatingTabBar] activeRide from context:', activeRide?.rideId || 'null');

  // Determine which tabs are accessible based on capabilities
  const canAccessMap = capabilities?.canAccessMap === true;
  const canAccessSavedRoutes = capabilities?.canAccessSavedRoutes === true;
  const canAccessGroups = capabilities?.canAccessGroups === true;
  const canAccessCalendar = capabilities?.canAccessCalendar === true;
  const canAccessProfile = capabilities?.canAccessProfile === true;

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
    { name: "map", icon: "map", disabled: !canAccessMap },
    { name: "saved-routes", icon: "git-branch", disabled: !canAccessSavedRoutes },
    { name: "groups", icon: "people", disabled: !canAccessGroups },
    { name: "calendar", icon: "calendar", disabled: !canAccessCalendar },
    { name: "profile", icon: "person", disabled: !canAccessProfile },
  ];

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: "absolute",
        left: 15,
        right: 15,
        bottom: insets.bottom,
        height: 56,
        backgroundColor: theme.colors.primaryDark,
        borderRadius: 28,
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
        const isDisabled = tab.disabled === true;
        const isProfileTab = tab.name === "profile";
        const baseColor = isDisabled
          ? theme.colors.primaryMid
          : isFocused
            ? activeColor
            : inactiveColor;
        const color = isProfileTab && user ? theme.colors.accentDark : baseColor;

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => {
              if (isDisabled) return;
              router.push(tab.name);
            }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 6,
              opacity: isDisabled ? 0.6 : 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isFocused ? tab.icon : `${tab.icon}-outline`}
                size={32}
                color={color}
              />
            </View>
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

          {/* Re-centre / Stop Sharing */}
          <TouchableOpacity
            onPress={() => {
              if (activeRide && mapActions?.endRide) {
                Alert.alert(
                  "Stop Sharing Location?",
                  "This will end your active ride and stop sharing your location with other riders.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Stop Sharing",
                      style: "destructive",
                      onPress: mapActions.endRide,
                    },
                  ]
                );
              } else {
                mapActions?.recenter();
              }
            }}
            style={{ paddingHorizontal: 6 }}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={28}
              color={activeRide ? theme.colors.danger : theme.colors.primary}
            />
          </TouchableOpacity>

          {/* Follow Me */}
          <LongPressGestureHandler
            onActivated={() => {
              if (mapActions?.isFollowing?.()) {
                // When following: reroute from current location if there's an active route
                if (mapActions?.canRefreshRoute?.()) {
                  mapActions?.refreshRoute?.();
                }
              } else {
                // When NOT following: route to home
                mapActions?.routeToHome?.();
              }
            }}
            minDurationMs={500}
          >
            <TouchableOpacity
              onPress={() => mapActions?.toggleFollow()}
              style={{ paddingHorizontal: 6 }}
            >
              <MaterialCommunityIcons
                name={"navigation-variant"}
                size={28}
                color={
                  mapActions?.isFollowing()
                    ? theme.colors.danger
                    : theme.colors.primary
                }
              />
            </TouchableOpacity>
          </LongPressGestureHandler>
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
              size={28}
              color={theme.colors.primaryMid}
            />
          </TouchableOpacity>

          {/* Follow Me */}
          <TouchableOpacity
            style={{ paddingHorizontal: 6 }}
          >
            <MaterialCommunityIcons
              name={"navigation-variant"}
              size={28}
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
  const { user, loading, versionStatus, isGuest } = useContext(AuthContext);

  // Show version modal when status changes and update is available
  useEffect(() => {
    if (versionStatus && versionStatus.hasUpdate && !versionModalDismissed) {
      if (versionStatus.isRequired) {
        setShowVersionModal(true);
      } else if (!versionModalDismissed) {
        setShowVersionModal(true);
      }
    }
  }, [versionStatus, versionModalDismissed]);

  const handleDismissVersion = () => {
    setShowVersionModal(false);
    // Small delay to ensure modal fully closes before updating dismissed state
    setTimeout(() => {
      setVersionModalDismissed(true);
    }, 100);
  };

  const currentVersion = Constants.expoConfig?.version || "1.0.0";

  if (loading) {
    // Optionally, show a loading spinner here
    return null;
  }

  if (!user && !isGuest) {
    // Not authenticated and not in guest mode: show login screen
    // Import LoginScreen directly instead of using layout to avoid Expo Router conflicts
    const LoginScreen = require("@/core/auth/login").default;
    return <LoginScreen />;
  }

  // Authenticated or guest mode: show main app with tabs
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <Tabs.Screen name="map" />
        <Tabs.Screen name="saved-routes" />
        <Tabs.Screen name="groups" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="profile" />
      </Tabs>

      {versionStatus && versionStatus.hasUpdate && (
        <VersionUpgradeModal
          visible={showVersionModal}
          isRequired={versionStatus.isRequired}
          currentVersion={currentVersion}
          newVersion={versionStatus.versionInfo?.latestVersion || "unknown"}
          releaseNotes={versionStatus.versionInfo?.releaseNotes}
          onDismiss={handleDismissVersion}
        />
      )}
    </>
  );
}

export default function Layout() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashChecked, setSplashChecked] = useState(false);

  // Check if splash has been shown for this version
  useEffect(() => {
    const checkSplashStatus = async () => {
      try {
        const currentVersion = Constants.expoConfig?.version || "1.0.0";
        const lastSplashVersion = await AsyncStorage.getItem("@lastSplashVersion");
        // Show splash if:
        // 1. First time launch (no version stored)
        // 2. Version has changed (major update)
        if (!lastSplashVersion || lastSplashVersion !== currentVersion) {
          setShowSplash(true);
          // Mark this version as shown
          await AsyncStorage.setItem("@lastSplashVersion", currentVersion);
        } else {
          setShowSplash(false);
        }
        setSplashChecked(true);
      } catch (error) {
        console.error("Error checking splash status:", error);
        setShowSplash(false);
        setSplashChecked(true);
      }
    };

    checkSplashStatus();
  }, []);

  // Log metrics summary when app goes to background or on unmount
  useEffect(() => {
    return () => {
      // Log on cleanup/app background
      getAndResetSummary();
    };
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Don't render anything until we've checked splash status
  if (!splashChecked) {
    return null;
  }

  // Show splash screen if needed
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

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

import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { GoogleMaps } from "expo-maps";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Header } from "../../components/layout/Header";
import { theme } from "../../config/theme";

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===== Request Location Permissions =====
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Location permission denied.");
        setLoading(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setLoading(false);
    })();
  }, []);
console.log("API KEY IN APP:", Constants.expoConfig.extra.googleMapsApiKey);

  return (
    <View style={{ flex: 1 }}>
      <Header mode="logo-title" title="Map" />

      {/* If loading OR no permission */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primaryLight} />
        </View>
      ) : (
        <GoogleMaps.View
          style={StyleSheet.absoluteFill}
          camera={{
            center: {
              latitude: location?.latitude || 51.5072,
              longitude: location?.longitude || -0.1276,
            },
            zoom: 12,
          }}
          showsUserLocation={true}
        />
      )}

      {/* Floating Action Button (we’ll repurpose this later) */}
      <Pressable style={styles.floatingButton}>
        <Ionicons
          name="navigate"
          size={26}
          color={theme.colors.primaryLight}
        />
      </Pressable>

      {/* Bottom sheet placeholder */}
      <View style={styles.bottomSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",

    // Slight shadow to match your floating tab bar
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 0, // empty for now (will slide up later)
  },
});

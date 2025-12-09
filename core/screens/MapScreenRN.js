import { AuthContext } from "@context/AuthContext";
import theme from "@themes";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";


export default function MapScreenRN() {
  const router = useRouter();
  const mapRef = useRef(null);

  const { capabilities } = useContext(AuthContext);

  const [region, setRegion] = useState(null);
  const [loading, setLoading] = useState(true);

  // ------------------------------------------------
  // GET USER LOCATION
  // ------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission denied");
          setRegion({
            latitude: 52.1364,
            longitude: -0.4607,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

        setRegion(newRegion);
        setLoading(false);

        // Center the map when loaded
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
          }
        }, 300);

      } catch (err) {
        console.log("Location error:", err);
        setLoading(false);
      }
    })();
  }, []);

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        followsUserLocation={false}
        showsMyLocationButton={true}
        initialRegion={
          region || {
            latitude: 52.1364,
            longitude: -0.4607,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }
        }
      />

      {capabilities?.canAddVenue && (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: theme.colors.accent }
          ]}
          onPress={() => router.push("/add-venue")}
        >
          <Text style={[styles.fabText, { color: theme.colors.primaryDark }]}>
            Add Missing Venue
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  fab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 5,
    minWidth: 160,
    alignItems: "center",
  },

  fabText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

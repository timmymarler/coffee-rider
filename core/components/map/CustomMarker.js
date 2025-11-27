import { useTheme } from "@/config/theme";
import * as GoogleMaps from "expo-maps";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function CustomMarker({ coordinate, title, onPress }) {
  const theme = useTheme();

  return (
    <GoogleMaps.Marker
      coordinate={coordinate}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <Pressable style={styles.pinContainer}>
        <View style={[styles.pin, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.pinText}>☕</Text>
        </View>
      </Pressable>
    </GoogleMaps.Marker>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  pinText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },
});

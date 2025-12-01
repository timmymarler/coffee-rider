// core/map/components/CafeMarker.js
import { Ionicons } from "@expo/vector-icons";
import { getTheme } from "@themes";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";

export function CafeMarker({ cafe, onPress }) {
  const theme = getTheme();

  const lat =
    cafe.coords?.latitude ?? cafe.latitude ?? cafe.lat;
  const lng =
    cafe.coords?.longitude ?? cafe.longitude ?? cafe.lng;

  if (lat == null || lng == null) return null;

  const isSponsor = cafe.sponsor === true;

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress?.();
      }}
    >
      <View
        style={[
          styles(theme).outer,
          isSponsor && styles(theme).outerSponsor,
        ]}
      >
        <View style={styles(theme).inner}>
          <Ionicons
            name="cafe"
            size={14}
            color={theme.colors.primaryDark}
          />
        </View>
      </View>
    </Marker>
  );
}

const styles = (theme) =>
  StyleSheet.create({
    outer: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    outerSponsor: {
      borderColor: theme.colors.accentDark,
    },
    inner: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
    },
  });

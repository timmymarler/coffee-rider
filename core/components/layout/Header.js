import logo from "@assets/rider/logo.png";
import { theme } from "@config/theme";
import { Image, StyleSheet, Text, View } from "react-native";

export function Header({ mode = "text", title = "" }) {
  return (
    <View style={styles.container}>

      {/* Logo + Big Title (Login etc.) */}
      {mode === "logo-text" && (
        <View style={styles.row}>
          <Image source={logo} style={styles.logoLarge} />
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      {/* Logo Only */}
      {mode === "logo" && (
        <Image source={logo} style={styles.logoSmall} />
      )}

      {/* Title Only */}
      {mode === "text" && (
        <Text style={styles.title}>{title}</Text>
      )}

      {/* Small Icon Left + Centered Title */}
      {mode === "icon-title" && (
        <View style={styles.iconTitleRow}>
          
          <Image source={logo} style={styles.logoSmall} />

          {/* Centered Title */}
          <View style={styles.centerBox}>
            <Text style={styles.title}>{title}</Text>
          </View>

          {/* Spacer to keep title centered */}
          <View style={{ width: 28 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: theme.colors.background,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  iconTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  centerBox: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },

  logoLarge: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },

  logoSmall: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },

  title: {
    fontSize: 22,
    fontWeight: "600",
    color: theme.colors.primaryLight,
  },
});

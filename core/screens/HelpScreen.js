import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useContext } from "react";
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuthContext } from "@context/AuthContext";
import { getCapabilities } from "@core/roles/getCapabilities";
import theme from "@themes";

const { width: screenWidth } = Dimensions.get("window");

export default function HelpScreen() {
  const { role = "guest" } = useContext(AuthContext);
  const capabilities = getCapabilities(role);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* -------------------------------------------------- */}
      {/* HEADER                                            */}
      {/* -------------------------------------------------- */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Welcome to Coffee {theme.brandName?.name || "Rider"}
        </Text>

        <Text style={styles.subTitle}>
          You are currently using the app as a{" "}
          <Text style={styles.role}>{role}</Text>.
        </Text>

        <Text style={styles.text}>
          Coffee {theme.brandName?.name || "Rider"} helps riders, drivers and
          walkers discover great places to stop, meet and ride to — all shown
          directly on the map.
        </Text>
      </View>

      {/* -------------------------------------------------- */}
      {/* WHAT YOU CAN DO                                   */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What you can do</Text>

        {role === "guest" && (
          <>
            <Text style={styles.bullet}>• View places on the map</Text>
            <Text style={styles.bullet}>• Search for cafés and meeting spots</Text>
            <Text style={styles.bullet}>• Navigate to places</Text>
          </>
        )}

        {role === "user" && (
          <>
            <Text style={styles.bullet}>• Everything a guest can do</Text>
            <Text style={styles.bullet}>• Add new places to Coffee Rider</Text>
            <Text style={styles.bullet}>• Rate and comment on places</Text>
          </>
        )}

        {role === "pro" && (
          <>
            <Text style={styles.bullet}>• Everything a logged-in user can do</Text>
            <Text style={styles.bullet}>• Save and manage routes</Text>
            <Text style={styles.bullet}>• Multi-stop navigation</Text>
            <Text style={styles.bullet}>• Advanced rider features</Text>
          </>
        )}

        {role === "admin" && (
          <>
            <Text style={styles.bullet}>• Full administrative access</Text>
            <Text style={styles.bullet}>• Manage places and users</Text>
            <Text style={styles.bullet}>• Moderate comments and ratings</Text>
          </>
        )}
      </View>

      {/* -------------------------------------------------- */}
      {/* MAP CONTROLS                                      */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map controls</Text>

        <View style={styles.controlRow}>
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color={theme.colors.accentMid}
            style={styles.controlIcon}
          />
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Re-centre</Text> — moves the map
            back to your current location.
          </Text>
        </View>

        <View style={styles.controlRow}>
          <MaterialCommunityIcons
            name="navigation"
            size={22}
            color={theme.colors.accentMid}
            style={styles.controlIcon}
          />
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Follow Me</Text> — keeps the map
            centred on you as you move. Dragging the map will turn this off.
          </Text>
        </View>
      </View>

      {/* -------------------------------------------------- */}
      {/* FEATURE HINTS                                     */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feature notes</Text>

        {!capabilities.canAddPlaces && (
          <Text style={styles.subText}>
            • Adding new places is available to registered users.
          </Text>
        )}

        {!capabilities.canSaveRoutes && (
          <Text style={styles.subText}>
            • Saving routes and advanced navigation are available to Pro users.
          </Text>
        )}

        {capabilities.canAddPlaces && (
          <Text style={styles.subText}>
            • You can help grow Coffee Rider by adding new places.
          </Text>
        )}
      </View>

      {/* -------------------------------------------------- */}
      {/* ACCOUNT TYPES                                     */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account types</Text>

        <Text style={styles.bullet}>• Guest – browse and search places</Text>
        <Text style={styles.bullet}>• User – add places, ratings and comments</Text>
        <Text style={styles.bullet}>
          • Pro – advanced routing and navigation tools
        </Text>
      </View>

      {/* -------------------------------------------------- */}
      {/* FEEDBACK / SUPPORT                                 */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feedback & support</Text>

        <Text style={styles.text}>
          Coffee Rider is in active development. Bug reports and suggestions are
          always welcome.
        </Text>

        <Pressable
          onPress={() => Linking.openURL("mailto:support@coffee-rider.co.uk")}
        >
          <Text style={styles.link}>
            support@coffee-rider.co.uk
          </Text>
        </Pressable>
      </View>

      {/* -------------------------------------------------- */}
      {/* FOOTER                                            */}
      {/* -------------------------------------------------- */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Built by riders, for riders.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingBottom: 40,
    backgroundColor: theme.colors.primaryLight,
  },

  header: {
    width: screenWidth * 0.9,
    paddingTop: 24,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.accentMid,
    marginBottom: 6,
  },

  subTitle: {
    fontSize: 14,
    color: theme.colors.accentDark,
    marginBottom: 12,
  },

  role: {
    fontWeight: "600",
    color: theme.colors.accentMid,
  },

  text: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },

  section: {
    width: screenWidth * 0.9,
    marginTop: 28,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.accentMid,
    marginBottom: 10,
  },

  bullet: {
    fontSize: 14,
    color: theme.colors.acc,
    marginBottom: 6,
  },

  subText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },

  controlRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  controlIcon: {
    marginRight: 10,
    marginTop: 2,
  },

  controlText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.primaryDark,
    lineHeight: 20,
  },

  controlLabel: {
    fontWeight: "600",
  },

  link: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.accentMid,
    fontWeight: "600",
  },

  footer: {
    marginTop: 40,
  },

  footerText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});

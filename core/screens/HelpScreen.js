import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useContext } from "react";
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuthContext } from "@context/AuthContext";
import { getCapabilities } from "@core/roles/getCapabilities";
import theme from "@themes";
import SvgPin from "../map/components/SvgPin";


const { width: screenWidth } = Dimensions.get("window");

export default function HelpScreen() {
  const { role = "guest" } = useContext(AuthContext);
  const capabilities = getCapabilities(role);
  const markerStyles = {
    destination: {
      fill: theme.colors.primary,
      circle: theme.colors.accentMid,
      stroke: theme.colors.danger,
    },
    searchCR: {
      fill: theme.colors.accent,
      circle: theme.colors.accentLight,
      stroke: theme.colors.primaryMid,
    },
    searchGoogle: {
      fill: theme.colors.primaryMid,
      circle: theme.colors.accentLight,
      stroke: theme.colors.primaryDark,
    },
    cr: {
      fill: theme.colors.accentMid,
      circle: theme.colors.accentLight,
      stroke: theme.colors.accentDark,
    },
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* -------------------------------------------------- */}
      {/* HEADER                                            */}
      {/* -------------------------------------------------- */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Welcome to Coffee {theme.brandName?.name || "Rider"}
        </Text>

        <Text style={styles.text}>
          Coffee {theme.brandName?.name || "Rider"} helps riders, drivers and
          walkers discover great places to stop, meet and ride to — all shown
          directly on the map.
        </Text>

        <Text style={styles.subTitle}>
          You are currently using the app as a{" "}
          <Text style={styles.role}>{role}</Text> user.
        </Text>
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
            color={theme.colors.primary}
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
            color={theme.colors.primary}
            style={styles.controlIcon}
          />
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Follow Me</Text> — tapping this icon (or activating Navigation) keeps the map
            centred on you as you move. Dragging the map will turn this off.
          </Text>
        </View>

        <View style={styles.controlRow}>
          <MaterialCommunityIcons
            name="navigation"
            size={22}
            color={theme.colors.danger}
            style={styles.controlIcon}
          />
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Follow Me (Active)</Text> — when you enable Follow Me, the icon will turn red
          </Text>
        </View>
      </View>

      {/* -------------------------------------------------- */}
      {/* MARKER ICONS                                       */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Place categories</Text>
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Place Icons</Text> — different icons will appear in the markers to identify the category of each place.
          </Text>
        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="coffee" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Cafés and coffee stops</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Restaurants and food venues</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="beer" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Pubs and bars</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="motorbike" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Bike/Scooter garages and service centres</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="gas-station" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Fuel stations</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="parking" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Parking areas</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="forest" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Scenic viewpoints and stops</Text>
        </View>
      </View>

      {/* -------------------------------------------------- */}
      {/* MAP MARKERS                                        */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map markers</Text>

        <View style={styles.legendRow}>
          <SvgPin {...markerStyles.cr} size={34} />
          <Text style={styles.legendText}>
            Coffee Rider places — added by the community and always shown on the map.
          </Text>
        </View>

        <View style={styles.legendRow}>
          <SvgPin {...markerStyles.searchCR} size={34} />
          <Text style={styles.legendText}>
            Highlighted Coffee Rider places — match your current search.
          </Text>
        </View>

        <View style={styles.legendRow}>
          <SvgPin {...markerStyles.searchGoogle} size={34} />
          <Text style={styles.legendText}>
            Search results — temporary places from Google that disappear when search
            is cleared.
          </Text>
        </View>

        <View style={styles.legendRow}>
          <SvgPin {...markerStyles.destination} size={34} />
          <Text style={styles.legendText}>
            Destination — the place you are navigating to or routing towards.
          </Text>
        </View>
      </View>


      {/* -------------------------------------------------- */}
      {/* FEATURE HINTS                                     */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feature notes</Text>

        {!capabilities.canAddPlaces && (
          <Text style={styles.legendText}>
            • Adding new places is available to registered users.
          </Text>
        )}

        {!capabilities.canSaveRoutes && (
          <Text style={styles.legendText}>
            • Saving routes and advanced navigation are available to Pro users.
          </Text>
        )}

        {capabilities.canAddPlaces && (
          <Text style={styles.legendText}>
            • You can help grow Coffee Rider by adding new places.
          </Text>
        )}
      </View>

      {/* -------------------------------------------------- */}
      {/* WHAT YOU CAN DO                                    */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guests - What you can do</Text>
          <>
            <Text style={styles.bullet}>• View Coffee Rider places on the map</Text>
            <Text style={styles.bullet}>
              • Search previously added Coffee Rider cafés and meeting spots
            </Text>
            <Text style={styles.bullet}>• View place details, photos and ratings</Text>
          </>

        <Text style={styles.sectionTitle}>Standard Users - What you can do</Text>
          <>
            <Text style={styles.bullet}>• Everything a guest can do</Text>
            <Text style={styles.bullet}>• Search for new places using Google</Text>
            <Text style={styles.bullet}>• See Routes & Navigate to places</Text>
            <Text style={styles.bullet}>• Add ratings and comments</Text>
          </>

        <Text style={styles.sectionTitle}>Pro Users - What you can do</Text>
          <>
            <Text style={styles.bullet}>• Everything a Standard user can do</Text>
            <Text style={styles.bullet}>• Higher Google search limits</Text>
            <Text style={styles.bullet}>• Save and manage routes</Text>
            <Text style={styles.bullet}>• Multi-stop navigation</Text>
          </>

        <Text style={styles.sectionTitle}>Admin Users - What you can do</Text>
          <>
            <Text style={styles.bullet}>• Full administrative access</Text>
            <Text style={styles.bullet}>• Manage places and users</Text>
            <Text style={styles.bullet}>• Moderate comments and ratings</Text>
          </>
      </View>

      {/* -------------------------------------------------- */}
      {/* LIMITS & FAIR USE                                 */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Limits & fair use</Text>

        {role === "guest" && (
          <Text style={styles.subText}>
            • Guests can browse Coffee Rider places only. Searching external
            places and navigation require a registered account.
          </Text>
        )}

        {role !== "guest" && (
          <>
            <Text style={styles.subText}>
              • Google place searches are limited per day to keep the service
              fast and fair for everyone.
            </Text>
            <Text style={styles.subText}>
              • During beta testing, higher limits may be temporarily applied.
            </Text>
          </>
        )}
      </View>

      {/* -------------------------------------------------- */}
      {/* FEEDBACK / SUPPORT                                 */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feedback & support</Text>

        <Text style={styles.text}>
          Coffee Rider is in active beta. Bug reports and suggestions are always
          welcome.
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
    color: theme.colors.primaryDark,
    marginBottom: 6,
  },

  subText: {
    fontSize: 13,
    color: theme.colors.primaryDark,
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

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  legendText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: theme.colors.primaryDark,
    lineHeight: 20,
  },

});

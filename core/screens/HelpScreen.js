import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useContext, useRef } from "react";
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuthContext } from "@context/AuthContext";
import { getCapabilities } from "@core/roles/capabilities";
import theme from "@themes";
import { useLocalSearchParams } from "expo-router";
import SvgPin from "../map/components/SvgPin";


const { width: screenWidth } = Dimensions.get("window");

export default function HelpScreen() {
  const { section } = useLocalSearchParams?.() || {};
  const { role = "guest" } = useContext(AuthContext);
  const capabilities = getCapabilities(role);
  const scrollRef = useRef(null);
  const sharedSectionY = useRef(null);
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
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
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
            name="crosshairs-gps"
            size={22}
            color={theme.colors.danger}
            style={styles.controlIcon}
          />
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Location Sharing</Text> — when you start a group ride, your live location is shared with other riders in real-time (every 10 seconds). You'll see their markers on the map too. Your location is ONLY shared when you explicitly start a ride and ONLY visible to riders on the same route in the same group. Ending your ride immediately stops all sharing.
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
            <Text style={styles.controlLabel}>Follow Me (Active)</Text> — when you enable Follow Me, the icon will turn red and the map stays centered on your location. Your location is visible on the map in real-time.
          </Text>
        </View>
        <View style={styles.controlRow}>
          <MaterialCommunityIcons
            name="refresh"
            size={22}
            color={theme.colors.accent}
            style={styles.controlIcon}
          />
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Refresh Route</Text> — when in Follow Me mode with an active route, long press the Follow Me icon to refresh your route from your current location. Perfect for getting back on track if you've gone off route.
          </Text>
        </View>
        <View style={styles.controlRow}>
          <MaterialCommunityIcons
            name="home"
            size={22}
            color={theme.colors.primary}
            style={styles.controlIcon}
          />
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Route to Home</Text> — when not following, long press the Follow Me icon to create a route from your current location to your home address. Make sure you've added your home address in your Profile first. This will automatically enable Follow Me mode to guide you home.
          </Text>
        </View>
        <Text style={styles.sectionTitle}>Map actions</Text>
        <View style={styles.legendRow}>
          <SvgPin {...markerStyles.cr} size={24} />
          <Text style={styles.legendText}>
            <Text style={styles.controlLabel}>Place Details</Text> - Tap any marker to open the Place Card. There you can see details including category, address, distance, 
            photos  (add your own to enhance the listing), suitability, amenities and you can see the 
            default route and load your navigation software.
          </Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.waypointPin}></View>
          <Text style={styles.legendText}>
            <Text style={styles.controlLabel}>Way Points</Text> - Long Press on any marker (or any location) and immediately show the suggested route and load your navigation software 
            from the main screen. Want to route via different places? Long Press on the map to add way points.
          </Text>
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

        <View style={styles.legendRow}>
          <Text style={styles.legendText}>
            <Text style={styles.controlLabel}>Sponsored places</Text> — Markers with a red outline indicate places with active sponsorships. These markers are slightly larger than regular markers.
          </Text>
        </View>
      </View>

      {/* -------------------------------------------------- */}
      {/* ROUTE OPTIMIZATION                                 */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route optimization</Text>

        <Text style={styles.subText}>
          Choose different route types to match your riding preferences. Tap the route button on the search bar to select your preferred optimization.
        </Text>

        <Text style={styles.bullet}>
          <Text style={styles.controlLabel}>⚡ Fastest</Text> — Optimizes for travel time while keeping sensible routes. Uses all road types to get you there quickly.
        </Text>

        <Text style={styles.bullet}>
          <Text style={styles.controlLabel}>🎢 Curvy</Text> — Thrilling routes with smooth curves and moderate windingness. Great for spiraling mountain passes and flowing A-roads.
        </Text>

        <Text style={styles.bullet}>
          <Text style={styles.controlLabel}>🌀 Twisty</Text> — Maximum turns and curves on interesting roads. Perfect for riders seeking the most winding path.
        </Text>

        <Text style={styles.bullet}>
          <Text style={styles.controlLabel}>🏔️ Adventure</Text> — Hilly mountain roads with elevation changes. Ideal for exploring scenic terrain and challenging climbs.
        </Text>

        <Text style={styles.bullet}>
          <Text style={styles.controlLabel}>⚙️ Custom</Text> — Design your own route by choosing your preferred level of windingness (turns) and hilliness (elevation). Select from Low, Normal, or High for each parameter.
        </Text>

        <Text style={[styles.subText, { marginTop: 12 }]}>
          <Text style={styles.controlLabel}>Waypoints:</Text> Long press on any location to add waypoints. Your route will recalculate to pass through all waypoints in order while maintaining your selected route optimization.
        </Text>
      </View>

      {/* -------------------------------------------------- */}
      {/* Place Categories                                   */}
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
      {/* Place Amenities                                   */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Place amenities</Text>
          <Text style={styles.controlText}>
            <Text style={styles.controlLabel}>Amenities Icons</Text> — different icons will appear in the markers 
            to identify the various different amenities that are available at the place you are viewing.
          </Text>
        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="parking" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Has its own car park</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="motorbike" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Parking suitable for bikes and scooters</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="ev-station" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Has EV charging points</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="toilet" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Has toilets on site</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="dog-side" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Pet Friendly</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="wheelchair" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Wheelchar accessible</Text>
        </View>

        <View style={styles.legendRow}>
          <MaterialCommunityIcons name="table-picnic" size={22} color={theme.colors.primaryDark} />
          <Text style={styles.legendText}>Has outside seating</Text>
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
      {/* GROUPS & SHARED ROUTES                             */}
      {/* -------------------------------------------------- */}
      {capabilities.canAccessGroups && (
        <View
          style={styles.section}
          onLayout={(e) => {
            sharedSectionY.current = e.nativeEvent.layout.y;
            if (section === "shared-location" && scrollRef.current && sharedSectionY.current != null) {
              scrollRef.current.scrollTo({ y: Math.max(sharedSectionY.current - 12, 0), animated: true });
            }
          }}
        >
          <Text style={styles.sectionTitle}>Groups & shared routes</Text>

          <Text style={styles.subText}>
            Groups let you organize rides with friends and share routes with your community.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Create a Group</Text> — Use the Groups tab to create a group for your riding community. Invite members by entering their email addresses.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Manage Members</Text> — Add, remove, or manage members in your group. Group owners can accept or decline member requests.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Share Routes</Text> — Save a route to your Saved Routes, then tap the Share button to choose visibility level and optionally share it with a specific group.
          </Text>

          <Text style={styles.subText}>
            <Text style={styles.controlLabel}>Route visibility levels:</Text>
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Private</Text> — Only you can see this route. Perfect for personal routes.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Group</Text> — Share with members of a specific group. Group members can view and load this route.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Public</Text> — Anyone in Coffee Rider can see this route. Great for suggesting popular routes.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>View Shared Routes</Text> — Select a group in the Groups tab to see all routes shared with that group. Tap any route to load it on the map.
          </Text>

          <Text style={[styles.subText, { marginTop: 16 }]}>
            <Text style={styles.controlLabel}>Real-time location sharing:</Text>
          </Text>

          <Text style={styles.subText}>
            Share your live location with other riders while on a group ride. Your location is ONLY shared when you explicitly start a ride, and ONLY visible to riders on the same route in the same group.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Start a Ride</Text> — In the Groups tab, select a shared route and tap "Start Ride & Share Location". This begins real-time location sharing with other active riders on this route.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>Join a Ride</Text> — If a group ride is already active, open the shared route and tap "Join Ride" to appear to others. You can leave at any time.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>See Other Riders</Text> — When your ride is active, you'll see markers on the map showing other riders who are also actively riding the same route. Their locations update every 10 seconds.
          </Text>

          <Text style={styles.bullet}>
            <Text style={styles.controlLabel}>End a Ride</Text> — Tap "End Ride & Stop Sharing" to stop sharing your location. Your location stops being shared immediately.
          </Text>

          <Text style={[styles.subText, { marginTop: 12 }]}>
            <Text style={styles.controlLabel}>Requirements:</Text> You must be signed in, a member of the selected group, and on a route shared to that group. Location permissions are required and should be set to "Allow while using the app".
          </Text>

          <Text style={[styles.subText, { marginTop: 4 }]}>
            <Text style={styles.controlLabel}>Privacy:</Text> Location sharing only applies to group rides. Only riders on the same route in the same group can see your location. Ending your ride immediately stops all sharing.
          </Text>

          <Text style={[styles.subText, { marginTop: 4 }]}>
            <Text style={styles.controlLabel}>Troubleshooting:</Text> If riders are not appearing: (1) confirm the ride is active, (2) ensure you are a group member, (3) check location permissions and GPS accuracy, (4) disable battery optimization for Coffee Rider on Android, and (5) verify network connectivity.
          </Text>

          <Text style={[styles.subText, { marginTop: 8, fontStyle: 'italic' }]}>
            Privacy: Your location is never shared unless you start a ride. Only riders on the same route in the same group can see your location. Ending your ride immediately stops all location sharing.
          </Text>
        </View>
      )}

      {/* -------------------------------------------------- */}
      {/* WHAT YOU CAN DO                                    */}
      {/* -------------------------------------------------- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guests - What you can do</Text>
          <>
            <Text style={styles.bullet}>• View Coffee Rider places on the map</Text>
            <Text style={styles.bullet}>• Search previously added Coffee Rider cafés and meeting spots</Text>
            <Text style={styles.bullet}>• View place details and ratings</Text>
            <Text style={styles.bullet}>• See the suggested route to your destination</Text>
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
    color: theme.colors.accentMid,
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
    color: theme.colors.accentDark,
    marginBottom: 6,
  },

  subText: {
    fontSize: 13,
    color: theme.colors.accentDark,
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
    color: theme.colors.accentDark,
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
    color: theme.colors.accentDark,
    lineHeight: 20,
  },
  waypointPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563eb", // map blue
    justifyContent: "center",
    alignItems: "center",
  },

});

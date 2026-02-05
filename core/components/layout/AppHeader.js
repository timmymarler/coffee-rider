import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { usePathname, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getTitleFromPath(pathname) {
  if (pathname === "/map") return "Map";
  if (pathname === "/saved-routes") return "Saved Routes";
  if (pathname === "/groups") return "Groups";
  if (pathname === "/profile") return "Profile";
  if (pathname === "/help") return "Help";
  if (pathname === "/calendar") return "Calendar";
  if (pathname.includes("create-event")) return "Event";
  return "Coffee Rider";
}

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  const title = getTitleFromPath(pathname);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.left}>
        <MaterialCommunityIcons
          name="coffee"
          size={24}
          color={theme.colors.accentDark}
        />
        <Text style={styles.brand}>Coffee Rider</Text>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <TouchableOpacity
        style={styles.help}
        onPress={() => router.push("/help")}
      >
        <MaterialCommunityIcons
          name="help-circle-outline"
          size={22}
          color={theme.colors.accentDark}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  brand: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.accentDark,
  },

  title: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },

  help: {
    position: "absolute",
    right: 16,
    bottom: 10,
  },
});

import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { usePathname, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContext } from "react";
import { AuthContext } from "@context/AuthContext";

function getTitleFromPath(pathname) {
  if (pathname === "/map") return "Map";
  if (pathname === "/saved-routes") return "Saved Routes";
  if (pathname === "/groups") return "Groups";
  if (pathname === "/profile") return "Profile";
  if (pathname === "/help") return "Help";
  return "Coffee Rider";
}

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useContext(AuthContext);

  const title = getTitleFromPath(pathname);
  const userAvatar = profile?.photoURL || user?.photoURL;

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

      <View style={styles.rightIcons}>
        {user && (
          <TouchableOpacity
            style={[
              styles.profileIcon,
              {
                backgroundColor: userAvatar ? "transparent" : theme.colors.accent,
              },
            ]}
            onPress={() => router.push("/profile")}
          >
            {userAvatar ? (
              <Image
                source={{ uri: userAvatar }}
                style={styles.avatarImage}
              />
            ) : (
              <MaterialCommunityIcons
                name="account"
                size={20}
                color={theme.colors.primaryDark}
              />
            )}
          </TouchableOpacity>
        )}
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

  rightIcons: {
    position: "absolute",
    right: 16,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },

  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

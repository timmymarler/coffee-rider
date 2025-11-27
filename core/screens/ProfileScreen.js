import { theme } from "@/config/theme";
import { auth, db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { pickImageSquare } from "@lib/imagePicker";
import { uploadProfileImage } from "@lib/storage";
import { useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useContext, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen() {
  const { user, profile, loading } = useContext(AuthContext);
  const router = useRouter();

  // Local preference state (fallback to sensible defaults)
  const [defaultMode, setDefaultMode] = useState(
    profile?.defaultMode || "bike"
  );
  const [defaultRouteStyle, setDefaultRouteStyle] = useState(
    profile?.defaultRouteStyle || "scenic"
  );
  const [highAccuracy, setHighAccuracy] = useState(
    profile?.highAccuracy ?? true
  );

  async function handleChangePhoto() {
    try {
      const uri = await pickImageSquare();
      if (!uri) return;

      const downloadURL = await uploadProfileImage(user.uid, uri);

      await updateProfile(user, { photoURL: downloadURL });

      router.replace("/profile");
    } catch (err) {
      console.error("Failed to update profile photo:", err);
    }
  }

  async function handleUpdatePrefs(patch, localUpdate) {
    try {
      await updateDoc(doc(db, "users", user.uid), patch);
      localUpdate();
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  }

  const isPro = profile?.role === "pro";
  const isAdmin = profile?.role === "admin";

  // Loading state
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>You're not signed in</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = profile?.displayName || user.email;

  // Logged-in profile screen
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* HERO CARD */}
      <View style={styles.heroCard}>
        <TouchableOpacity onPress={handleChangePhoto}>
          <Image
            source={
              user.photoURL
                ? { uri: user.photoURL }
                : require("@/assets/default-avatar.png")
            }
            style={styles.avatar}
          />
        </TouchableOpacity>

        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.email}>{user.email}</Text>

        <View style={[styles.roleBadge, getRoleBadgeStyle(profile?.role)]}>
          <Text style={styles.roleBadgeText}>
            {profile?.role ? profile.role.toUpperCase() : "BASIC"}
          </Text>
        </View>
      </View>

      {/* UPGRADE CARD (shown if not pro/admin) */}
      {!isPro && !isAdmin && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upgrade to Coffee Rider Pro</Text>
          <Text style={styles.cardText}>
            Unlock multi-stop routing, favourites and more rider tools.
          </Text>
          <TouchableOpacity
            style={styles.cardButton}
            onPress={() => {
              // Placeholder: hook up real upgrade flow later
              console.log("Pro upgrade tapped");
            }}
          >
            <Text style={styles.cardButtonText}>View Pro Features</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STATS PANEL */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {profile?.cafeCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>Cafés added</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {profile?.routeCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>Routes saved</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {profile?.favouriteCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>Favourites</Text>
          </View>
        </View>
      </View>

      {/* SHORTCUTS PANEL */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Shortcuts</Text>

        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => router.push("/saved-routes")}
        >
          <Text style={styles.rowButtonText}>Your Saved Routes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => router.push("/add-cafe")}
        >
          <Text style={styles.rowButtonText}>Add a Café</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => {
            // Placeholder for future favourites screen
            console.log("Favourites tapped");
          }}
        >
          <Text style={styles.rowButtonText}>Your Favourites</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => {
            // Placeholder for future "My cafés" screen
            console.log("Cafés you added tapped");
          }}
        >
          <Text style={styles.rowButtonText}>Cafés you added</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => router.push("/profile/edit-profile")}
        >
          <Text style={styles.rowButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* PREFERENCES PANEL */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        {/* Default mode */}
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>Default mode</Text>
          <View style={styles.chipRow}>
            {["bike", "car", "walk"].map((mode) => {
              const active = defaultMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.chip,
                    active && { backgroundColor: theme.colors.accent },
                  ]}
                  onPress={() =>
                    handleUpdatePrefs(
                      { defaultMode: mode },
                      () => setDefaultMode(mode)
                    )
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && { color: "#000", fontWeight: "700" },
                    ]}
                  >
                    {mode.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Route style */}
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>Default route style</Text>
          <View style={styles.chipRow}>
            {["scenic", "fast", "avoid-motorways"].map((style) => {
              const active = defaultRouteStyle === style;
              return (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.chip,
                    active && { backgroundColor: theme.colors.accent },
                  ]}
                  onPress={() =>
                    handleUpdatePrefs(
                      { defaultRouteStyle: style },
                      () => setDefaultRouteStyle(style)
                    )
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && { color: "#000", fontWeight: "700" },
                    ]}
                  >
                    {style.replace("-", " ").toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* High accuracy toggle (simple text toggle for now) */}
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>High accuracy location</Text>
          <TouchableOpacity
            onPress={() =>
              handleUpdatePrefs(
                { highAccuracy: !highAccuracy },
                () => setHighAccuracy((prev) => !prev)
              )
            }
          >
            <Text style={styles.toggleText}>
              {highAccuracy ? "ON" : "OFF"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ADMIN PANEL */}
      {isAdmin && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Admin tools</Text>

          <TouchableOpacity
            style={styles.rowButton}
            onPress={() => console.log("Manage users tapped")}
          >
            <Text style={styles.rowButtonText}>Manage users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowButton}
            onPress={() => console.log("Manage cafés tapped")}
          >
            <Text style={styles.rowButtonText}>Manage cafés</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowButton}
            onPress={() => console.log("View reports tapped")}
          >
            <Text style={styles.rowButtonText}>View reports</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* DANGER ZONE */}
      <View style={[styles.card, { marginBottom: 30 }]}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => auth.signOut()}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getRoleBadgeStyle(role) {
  switch (role) {
    case "admin":
      return { backgroundColor: theme.colors.danger };
    case "pro":
      return { backgroundColor: theme.colors.accent };
    case "user":
      return { backgroundColor: theme.colors.primaryLight };
    default:
      return { backgroundColor: theme.colors.textMuted };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingBottom: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },

  /* HERO CARD */
  heroCard: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: theme.colors.accent,
    marginBottom: 10,
  },
  displayName: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  email: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 2,
    marginBottom: 8,
  },
  roleBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  /* CARDS */
  card: {
    backgroundColor: theme.colors.surface,
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    elevation: 4,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },

  /* Upgrade card */
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  cardText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: 10,
  },
  cardButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cardButtonText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  /* Buttons / rows */
  rowButton: {
    paddingVertical: 10,
  },
  rowButtonText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },

  /* Preferences */
  prefRow: {
    marginTop: 10,
  },
  prefLabel: {
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  toggleText: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: "600",
  },

  /* Account / logout */
  logoutButton: {
    marginTop: 10,
    backgroundColor: theme.colors.danger,
    paddingVertical: 10,
    borderRadius: 10,
  },
  logoutText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },

  /* Sign In */
  title: {
    fontSize: 22,
    color: theme.colors.text,
    marginBottom: 8,
  },
  button: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 15,
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});

import { theme } from "@/config/theme";
import { auth } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { pickImageSquare } from "@lib/imagePicker";
import { uploadProfileImage } from "@lib/storage";
import { useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { useContext } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen() {
  const { user, profile, loading } = useContext(AuthContext);
  const router = useRouter();

  // ⭐ THIS MUST BE INSIDE THE COMPONENT
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

  // Logged-in profile screen
  return (
    <View style={styles.container}>
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

        <Text style={styles.email}>{user.email}</Text>

        <View style={[styles.roleBadge, getRoleBadgeStyle(profile?.role)]}>
          <Text style={styles.roleBadgeText}>
            {profile?.role ? profile.role.toUpperCase() : "BASIC"}
          </Text>
        </View>
      </View>

      {/* IDENTITY PANEL */}
      <View style={styles.panel}>
        <View style={styles.row}>
          <Text style={styles.label}>Subscription</Text>
          <Text style={styles.value}>
            {profile?.subscriptionStatus || "free"}
          </Text>
        </View>

        <View style={styles.separator} />

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
          style={styles.logoutButton}
          onPress={() => auth.signOut()}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingBottom: 40,
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
    marginBottom: 15,
  },

  email: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "600",
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

  /* PANEL */
  panel: {
    backgroundColor: theme.colors.surface,
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
    elevation: 5,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  label: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },

  value: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },

  rowButton: {
    paddingVertical: 12,
  },

  rowButtonText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },

  separator: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginVertical: 12,
  },

  logoutButton: {
    marginTop: 25,
    backgroundColor: theme.colors.danger,
    paddingVertical: 12,
    borderRadius: 10,
  },

  logoutText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },

  /* Sign In */
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

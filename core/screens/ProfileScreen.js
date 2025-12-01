// core/screens/ProfileScreen.js

import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { pickImageSquare } from "@lib/imagePicker";
import { uploadImageAsync } from "@lib/storage";
import { getTheme } from "@themes";
import { useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen() {
  const { user, profile, loading, logout, refreshProfile } = useContext(AuthContext);
  const theme = getTheme();
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  // ----------------------------
  // Initial profile values
  // ----------------------------
  const initialDisplayName =
    profile?.displayName || user?.displayName || (user ? "Coffee Rider" : "");

  const initialBio = profile?.bio || "";
  const initialBike = profile?.bike || "";
  const initialLocation = profile?.homeLocation || "";

  const email = user?.email || profile?.email || "";
  const role = profile?.role || (user ? "user" : "guest");

  const avatarUri =
    profile?.photoURL ||
    user?.photoURL ||
    "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

  // Form state
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [bike, setBike] = useState(initialBike);
  const [homeLocation, setHomeLocation] = useState(initialLocation);

  // Update form when profile changes
  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || "");
    setBio(profile?.bio || "");
    setBike(profile?.bike || "");
    setHomeLocation(profile?.homeLocation || "");
  }, [profile, user]);

  // ----------------------------
  // Upload profile photo
  // ----------------------------
  async function handlePhotoUpload() {
    if (!user) return;

    try {
      const imageUri = await pickImageSquare();
      if (!imageUri) return;

      setUploading(true);

      const downloadURL = await uploadImageAsync(
        imageUri,
        `profilePhotos/${user.uid}.jpg`
      );

      await updateDoc(doc(db, "users", user.uid), {
        photoURL: downloadURL,
        updatedAt: Date.now(),
      });

      await refreshProfile();

      setUploading(false);
    } catch (err) {
      console.error("Profile upload error:", err);
      setUploading(false);
    }
  }

  // ----------------------------
  // Save profile fields
  // ----------------------------
  async function handleSaveProfile() {
    if (!user) return;

    setSaving(true);
    setSavedTick(false);

    try {
      const userRef = doc(db, "users", user.uid);

      const updatePayload = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        bike: bike.trim(),
        homeLocation: homeLocation.trim(),
        updatedAt: Date.now(),
      };

      await updateDoc(userRef, updatePayload);
      await refreshProfile();

      setSaving(false);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch (err) {
      console.error("Profile save error:", err);
      setSaving(false);
    }
  }

  // ----------------------------
  // UI STATES
  // ----------------------------

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
          Loading profile…
        </Text>
      </View>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text style={[styles.name, { color: theme.colors.primaryDark }]}>
          Anonymous Rider
        </Text>

        <Text
          style={[
            styles.email,
            { color: theme.colors.textMuted, marginTop: 4 },
          ]}
        >
          You’re not logged in.
        </Text>

        <TouchableOpacity
          style={[
            styles.primaryButtonGold,
            { marginTop: 24, paddingHorizontal: 32 },
          ]}
          onPress={() => router.push("/auth/login")}
        >
          <Text
            style={[
              styles.primaryButtonTextDark,
              { color: theme.colors.primaryDark },
            ]}
          >
            Log In
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAdmin = role === "admin";
  const isPro = role === "pro";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
    >
      {/* HEADER CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.primaryDark },
        ]}
      >
        <View style={styles.avatarRow}>
          <TouchableOpacity onPress={handlePhotoUpload} disabled={uploading}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            {uploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.name, { color: theme.colors.accent }]}>
              {displayName || "Coffee Rider"}
            </Text>

            <Text
              style={[styles.email, { color: theme.colors.textMuted }]}
            >
              {email}
            </Text>

            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: isAdmin
                      ? theme.colors.danger
                      : isPro
                      ? theme.colors.accent
                      : theme.colors.primary,
                    borderColor: theme.colors.textMuted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    { color: isAdmin ? "#fff" : theme.colors.primaryDark },
                  ]}
                >
                  {isAdmin ? "Admin" : isPro ? "Pro Rider" : "Rider"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* EDITABLE PROFILE CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.primaryDark },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.accentDark }]}>
          Profile
        </Text>

        {/* Display Name */}
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          Display Name
        </Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBackground,
              color: theme.colors.inputText,
              borderColor: theme.colors.inputBorder,
            },
          ]}
        />

        {/* Bike */}
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          Bike
        </Text>
        <TextInput
          value={bike}
          onChangeText={setBike}
          placeholder="e.g. Royal Enfield Guerrilla 450"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBackground,
              color: theme.colors.inputText,
              borderColor: theme.colors.inputBorder,
            },
          ]}
        />

        {/* Home Area */}
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          Home Area
        </Text>
        <TextInput
          value={homeLocation}
          onChangeText={setHomeLocation}
          placeholder="e.g. Bedford, UK"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBackground,
              color: theme.colors.inputText,
              borderColor: theme.colors.inputBorder,
            },
          ]}
        />

        {/* Bio */}
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          Rider Bio
        </Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about your riding style…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          style={[
            styles.input,
            styles.textArea,
            {
              backgroundColor: theme.colors.inputBackground,
              color: theme.colors.inputText,
              borderColor: theme.colors.inputBorder,
            },
          ]}
        />

        {/* Save Button */}
        <View style={styles.saveRow}>
          {savedTick && (
            <Text
              style={[styles.savedText, { color: theme.colors.accentDark }]}
            >
              Saved ✓
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButtonGold,
              { opacity: saving ? 0.7 : 1 },
            ]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primaryDark}
                style={{ marginRight: 8 }}
              />
            )}
            <Text
              style={[
                styles.primaryButtonTextDark,
                { color: theme.colors.primaryDark },
              ]}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ACCOUNT CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.primaryDark },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.accentDark }]}>
          Account
        </Text>

        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          Email
        </Text>
        <Text style={[styles.value, { color: theme.colors.text }]}>
          {email}
        </Text>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            { borderColor: theme.colors.textMuted },
          ]}
        >
          <Text
            style={[
              styles.secondaryButtonText,
              { color: theme.colors.textMuted },
            ]}
          >
            Change password (coming soon)
          </Text>
        </TouchableOpacity>
      </View>

      {/* LOGOUT BUTTON */}
      <TouchableOpacity
        style={[
          styles.logoutButton,
          { backgroundColor: theme.colors.danger },
        ]}
        onPress={logout}
      >
        <Text style={[styles.logoutText, { color: "#fff" }]}>
          Log Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 96, height: 96, borderRadius: 48 },

  avatarOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },

  name: { fontSize: 20, fontWeight: "600" },
  email: { fontSize: 13, marginTop: 2 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "600" },
  badgeRow: { flexDirection: "row", marginTop: 8 },

  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  label: { fontSize: 13, marginTop: 10, marginBottom: 4 },
  value: { fontSize: 14 },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },

  saveRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  savedText: {
    fontSize: 13,
    fontWeight: "500",
  },

  primaryButtonGold: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#FFD85C",
  },
  primaryButtonTextDark: {
    fontSize: 15,
    fontWeight: "600",
  },

  secondaryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },

  logoutButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

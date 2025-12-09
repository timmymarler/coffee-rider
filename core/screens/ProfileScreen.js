// core/screens/ProfileScreen.js

import { db } from "@/config/firebase";
import { AuthContext } from "@context/AuthContext";
import { pickImageSquare } from "@lib/imagePicker";
import { uploadImageAsync } from "@lib/storage";
import { doc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";

import { CRButton } from "@components-ui/CRButton";
import { CRCard } from "@components-ui/CRCard";
import { CRInfoBadge } from "@components-ui/CRInfoBadge";
import { CRInput } from "@components-ui/CRInput";
import { CRLabel } from "@components-ui/CRLabel";
import { CRScreen } from "@components-ui/CRScreen";
import theme from "@themes";
import { useRouter } from "expo-router";


export default function ProfileScreen() {
  const { user, profile, loading, logout, refreshProfile } = useContext(AuthContext);
  const router = useRouter();

  // -----------------------------------
  // Initial Values
  // -----------------------------------
  const avatarUri =
    profile?.photoURL ||
    user?.photoURL ||
    "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [bike, setBike] = useState(profile?.bike || "");
  const [homeLocation, setHomeLocation] = useState(profile?.homeLocation || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  const email = user?.email || "";
  const role = profile?.role || "user";

  // Update when profile changes
  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || "");
    setBio(profile?.bio || "");
    setBike(profile?.bike || "");
    setHomeLocation(profile?.homeLocation || "");
  }, [profile]);

  // -----------------------------------
  // Upload Avatar
  // -----------------------------------
  async function handlePhotoUpload() {
    if (!user) return;

    try {
      const imageUri = await pickImageSquare();
      if (!imageUri) return;

      setUploading(true);

      const downloadURL = await uploadImageAsync(
        imageUri,
        `profilePhotos/${user.uid}/avatar.jpg`
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

  // -----------------------------------
  // Save Profile Fields
  // -----------------------------------
  async function handleSaveProfile() {
    if (!user) return;

    setSaving(true);
    setSavedTick(false);

    try {
      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        bike: bike.trim(),
        homeLocation: homeLocation.trim(),
        updatedAt: Date.now(),
      });

      await refreshProfile();
      setSaving(false);

      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch (err) {
      console.error("Profile save error:", err);
      setSaving(false);
    }
  }

  // -----------------------------------
  // Not Logged In → Show Login Prompt
  // -----------------------------------
  if (!user && !loading) {
    return (
      <CRScreen padded scroll>
        <CRCard>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.spacing.xl,
              fontWeight: "600",
              marginBottom: theme.spacing.lg,
            }}
          >
            Anonymous Rider
          </Text>

          <Text
            style={{
              color: theme.colors.textMuted,
              marginBottom: theme.spacing.lg,
            }}
          >
            You’re not logged in.
          </Text>

          <CRButton title="Log In" onPress={() => router.push("/auth/login")} />
        </CRCard>
      </CRScreen>
    );
  }

  // -----------------------------------
  // MAIN PROFILE LAYOUT
  // -----------------------------------
  return (
    <CRScreen scroll padded>

      {/* ---------------- HEADER CARD ---------------- */}
      <CRCard
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Avatar */}
        <TouchableOpacity onPress={handlePhotoUpload} disabled={uploading}>
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              marginRight: theme.spacing.lg,
            }}
          />

          {uploading && (
            <View
              style={{
                position: "absolute",
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: theme.colors.primaryDark,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator color={theme.colors.primaryDark} />
            </View>
          )}
        </TouchableOpacity>

        {/* Name + Email + Role */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.accentMid,
              fontSize: theme.spacing.xl,
              fontWeight: "700",
            }}
          >
            {displayName || "Coffee Rider"}
          </Text>

          <Text
            style={{
              color: theme.colors.textMuted,
              marginTop: theme.spacing.xs,
            }}
          >
            {email}
          </Text>

          <View style={{ marginTop: theme.spacing.sm }}>
            <CRInfoBadge label={role.charAt(0).toUpperCase() + role.slice(1)} />
          </View>
        </View>
      </CRCard>

      {/* ---------------- PROFILE DETAILS CARD ---------------- */}
      <CRCard>

        <CRLabel>Display Name</CRLabel>
        <CRInput value={displayName} onChangeText={setDisplayName} />

        <CRLabel style={{ marginTop: theme.spacing.md }}>Bike</CRLabel>
        <CRInput value={bike} onChangeText={setBike} />

        <CRLabel style={{ marginTop: theme.spacing.md }}>Home Area</CRLabel>
        <CRInput value={homeLocation} onChangeText={setHomeLocation} />

        <CRLabel style={{ marginTop: theme.spacing.md }}>Rider Bio</CRLabel>
        <CRInput value={bio} onChangeText={setBio} multiline />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: theme.spacing.lg,
          }}
        >
          {savedTick && (
            <Text
              style={{
                color: theme.colors.accentMid,
                fontSize: theme.spacing.md,
                marginRight: theme.spacing.md,
              }}
            >
              Saved ✓
            </Text>
          )}

          <CRButton
            title={saving ? "Saving…" : "Save Changes"}
            loading={saving}
            onPress={handleSaveProfile}
            style={{ flex: 1 }}
          />
        </View>
      </CRCard>

      {/* ---------------- ACCOUNT CARD ---------------- */}
      <CRCard>
        <CRLabel>Email</CRLabel>
        <Text style={{ color: theme.colors.textPrimary, marginBottom: theme.spacing.md }}>
          {email}
        </Text>

        <CRButton
          title="Change Password (coming soon)"
          variant="secondary"
        />
      </CRCard>

      {/* ---------------- LOGOUT ---------------- */}
      <CRButton
        title="Log Out"
        variant="danger"
        onPress={logout}
        style={{ marginTop: theme.spacing.md }}
      />

    </CRScreen>
  );
}

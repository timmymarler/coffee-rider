// core/screens/ProfileScreen.js

import { db } from "@/config/firebase";
import { CRButton } from "@components-ui/CRButton";
import { CRCard } from "@components-ui/CRCard";
import { CRInfoBadge } from "@components-ui/CRInfoBadge";
import { CRInput } from "@components-ui/CRInput";
import { CRLabel } from "@components-ui/CRLabel";
import { CRScreen } from "@components-ui/CRScreen";
import { AuthContext } from "@context/AuthContext";
import { uploadImage } from "@core/utils/uploadImage";
import theme from "@themes";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";


export default function ProfileScreen() {

  const router = useRouter();
  const { user, profile, loading, logout, refreshProfile, capabilities } = useContext(AuthContext);

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

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [loading, user]);

  // -----------------------------------
  // Upload Avatar
  // -----------------------------------
  const handlePhotoUpload = async () => {
    if (!user) return;

    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,     // 🔥 enable crop UI
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) return;

    // 🔥 NEW: call Cloud Function
    const { url } = await uploadImage({
      user,
      type: "profile",
      imageBase64: asset.base64,
    });

    // Persist to Firestore
    // 🔥 cache-busting
    const cacheBustedUrl = `${url}?v=${Date.now()}`;

    await updateDoc(doc(db, "users", user.uid), {
      photoURL: cacheBustedUrl,
    });

    // Optional: update local UI state if you cache profile data
    await refreshProfile();
  };

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

      {/* ---------------- ACCOUNT & SECURITY ---------------- */}
      <CRCard>
        <CRLabel>Account</CRLabel>
          <View
            style={{
              marginTop: theme.spacing.xs,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primaryDark,
            }}
          >
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.spacing.sm,
              marginBottom: 2, // was too large before
            }}
          >
            Signed in as
          </Text>

          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.spacing.md,
              fontWeight: "500",
              lineHeight: theme.spacing.lg,
            }}
          >
            {email}
          </Text>
        </View>

      </CRCard>

      {/* ---------------- ACCOUNT ACTIONS ---------------- */}
      <CRCard>
        <CRButton
          title="Log Out"
          variant="danger"
          onPress={logout}
        />
      </CRCard>

    </CRScreen>
  );
}

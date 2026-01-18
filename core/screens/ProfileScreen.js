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
import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LoginScreen from "../auth/login";


export default function ProfileScreen() {

  const router = useRouter();
  const { user, profile, loading, logout, refreshProfile } = useContext(AuthContext);

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
  const [homeAddress, setHomeAddress] = useState(profile?.homeAddress || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  
  // Update when profile changes
  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || "");
    setBio(profile?.bio || "");
    setBike(profile?.bike || "");
    setHomeLocation(profile?.homeLocation || "");
    setHomeAddress(profile?.homeAddress || "");
  }, [profile]);

  const email = user?.email || "";
  const role = profile?.role || "user";

  if (loading) {
    return null;
  }

  if (!user) {
    return <LoginScreen />;
  }

 
  // -----------------------------------
  // Upload Avatar
  // -----------------------------------
  const handlePhotoUpload = async () => {
    if (!user) return;

    setUploading(true);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setUploading(false);
        return;
      }

      const mediaTypeImages = ImagePicker.MediaType?.Images || ImagePicker.MediaTypeOptions.Images;
      const mediaTypes = ImagePicker.MediaType ? [mediaTypeImages] : mediaTypeImages;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: true,     // 🔥 enable crop UI
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const asset = result.assets[0];
      if (!asset?.base64) {
        setUploading(false);
        return;
      }

      // 🔥 NEW: call Cloud Function
      const { url } = await uploadImage({
        type: "profile",
        imageBase64: asset.base64,
      });

      console.log('[ProfileScreen] URL from cloud function:', url);

      // Persist to Firestore
      // 🔥 cache-busting (preserve existing query, e.g., alt=media&token=...)
      // If no token present, add alt=media for public access
      let finalUrl = url;
      if (!url.includes('token=') && !url.includes('alt=media')) {
        const separator = url.includes('?') ? '&' : '?';
        finalUrl = `${url}${separator}alt=media`;
      }
      const separator = finalUrl.includes('?') ? '&' : '?';
      const cacheBustedUrl = `${finalUrl}${separator}v=${Date.now()}`;

      console.log('[ProfileScreen] Cache-busted URL to save:', cacheBustedUrl);

      await updateDoc(doc(db, "users", user.uid), {
        photoURL: cacheBustedUrl,
      });

      // Also update the active ride if user is currently riding
      try {
        const activeRideRef = doc(db, "activeRides", user.uid);
        const activeRideSnap = await getDoc(activeRideRef);
        if (activeRideSnap.exists()) {
          console.log('[ProfileScreen] Active ride exists, updating with new avatar:', cacheBustedUrl);
          await updateDoc(activeRideRef, {
            userAvatar: cacheBustedUrl,
          });
          console.log('[ProfileScreen] Active ride updated successfully');
        } else {
          console.log('[ProfileScreen] No active ride document for user:', user.uid);
        }
      } catch (err) {
        console.error('[ProfileScreen] Failed to update active ride:', err);
      }

      // Optional: update local UI state if you cache profile data
      await refreshProfile();
    } catch (error) {
      console.error('[ProfileScreen] Avatar upload error:', error);
    } finally {
      setUploading(false);
    }
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
        homeAddress: homeAddress.trim(),
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

  async function handleUpgrade() {
    if (!user) return;

    try {
      const userRef = doc(db, "users", user.uid);

      // Upgrade role
      await updateDoc(userRef, {
        role: "pro",
        upgradedAt: Date.now(),
      });

      // Log upgrade request
      await addDoc(collection(db, "upgradeRequests"), {
        uid: user.uid,
        email: user.email,
        displayName: displayName || "",
        requestedAt: Date.now(),
        status: "pending",
      });

      await refreshProfile();

    } catch (err) {
      console.error("Upgrade failed:", err);
    }
  }


  // -----------------------------------
  // MAIN PROFILE LAYOUT
  // -----------------------------------

  return (
    <CRScreen scroll padded={false} style={styles.cardScreen}>

      {/* ---------------- HEADER CARD ---------------- */}
      <View style={styles.cardWrap}>
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
            {role==="user" && (
              <CRButton
                title="Upgrade"
                variant="primary"
                onPress={handleUpgrade}
              >
              </CRButton>
            )}
          </View>

        </View>
      </CRCard>
      </View>

      {/* ---------------- PROFILE DETAILS CARD ---------------- */}
      <View style={styles.cardWrap}>
      <CRCard>

        <CRLabel>Display Name</CRLabel>
        <CRInput value={displayName} onChangeText={setDisplayName} />

        <CRLabel style={{ marginTop: theme.spacing.md }}>Bike</CRLabel>
        <CRInput value={bike} onChangeText={setBike} />

        <CRLabel style={{ marginTop: theme.spacing.md }}>Home Area</CRLabel>
        <CRInput value={homeLocation} onChangeText={setHomeLocation} />

        <CRLabel style={{ marginTop: theme.spacing.md }}>Home Address</CRLabel>
        <CRInput 
          value={homeAddress} 
          onChangeText={setHomeAddress} 
          placeholder="123 Main St, City, Postcode"
        />

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
        </View>
      </CRCard>
      </View>
      <View style={styles.cardWrap}>
      <CRCard>
        <View>
          <CRButton
            title={saving ? "Saving…" : "Save Changes"}
            loading={saving}
            onPress={handleSaveProfile}
            style={{ flex: 1 }}
          />
        </View>
      </CRCard>
      </View>

      {/* ---------------- ACCOUNT ACTIONS ---------------- */}
      <View style={styles.cardWrap}>
      <CRCard>
        <CRButton
          title="Log Out"
          variant="danger"
          onPress={logout}
        />
      </CRCard>
      </View>
    </CRScreen>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginHorizontal: 16,
    marginBottom: theme.spacing.sm, 
 },
  cardScreen: {
    paddingBottom: 42
  },

  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accentDark, // accentDark
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

})
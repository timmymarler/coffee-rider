// core/screens/ProfileScreen.js

import { db } from "@/config/firebase";
import { CRButton } from "@components-ui/CRButton";
import { CRCard } from "@components-ui/CRCard";
import { CRInfoBadge } from "@components-ui/CRInfoBadge";
import { CRInput } from "@components-ui/CRInput";
import { CRLabel } from "@components-ui/CRLabel";
import { CRScreen } from "@components-ui/CRScreen";
import { AuthContext } from "@context/AuthContext";
import { clearDebugLogs, exportDebugLogsAsText, getDebugLogs } from "@core/utils/debugLog";
import { renewSponsorship } from "@core/utils/sponsorshipUtils";
import { uploadImage } from "@core/utils/uploadImage";
import theme from "@themes";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Clipboard, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LoginScreen from "../auth/login";


export default function ProfileScreen() {

  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);  // Force image reload
  const [sponsorshipStatus, setSponsorshipStatus] = useState(null);
  const [renewingSponsorship, setRenewingSponsorship] = useState(false);
  const [placeId, setPlaceId] = useState(profile?.linkedPlaceId || "");
  const [placeName, setPlaceName] = useState("");
  const [placeCategory, setPlaceCategory] = useState("cafe");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeAmenities, setPlaceAmenities] = useState("");
  
  // Update when profile changes
  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || "");
    
    // Load different fields based on role
    if (profile?.role === "place-owner") {
      setPlaceId(profile?.linkedPlaceId || "");
    } else {
      setBio(profile?.bio || "");
      setBike(profile?.bike || "");
      setHomeLocation(profile?.homeLocation || "");
      setHomeAddress(profile?.homeAddress || "");
    }
  }, [profile]);

  // Load place data from places collection for place owners
  useEffect(() => {
    const loadPlaceData = async () => {
      if (role === "place-owner" && profile?.linkedPlaceId) {
        try {
          const placeRef = doc(db, "places", profile.linkedPlaceId);
          const placeSnap = await getDoc(placeRef);
          if (placeSnap.exists()) {
            const data = placeSnap.data();
            setPlaceName(data.name || "");
            setPlaceCategory(data.category || "cafe");
            setPlaceAddress(data.address || "");
            setPlaceAmenities(data.amenities || "");
          }
        } catch (error) {
          console.error("Error loading place data:", error);
        }
      }
    };
    loadPlaceData();
  }, [profile?.linkedPlaceId, role]);

  // Load debug logs on mount
  useEffect(() => {
    const loadLogs = async () => {
      const logs = await getDebugLogs();
      setDebugLogs(logs);
    };
    loadLogs();
  }, [showDebugPanel]);

  // Load sponsorship status for place owners from user document
  useEffect(() => {
    const loadSponsorshipStatus = async () => {
      if (role === "place-owner" && user?.uid) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && userSnap.data().sponsorship) {
            setSponsorshipStatus(userSnap.data().sponsorship);
          }
        } catch (error) {
          console.error("Error loading sponsorship:", error);
        }
      }
    };
    loadSponsorshipStatus();
  }, [profile, role, user?.uid]);

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
      // Force image reload by changing key
      setImageRefreshKey(prev => prev + 1);
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
      
      const updateData = {
        displayName: displayName.trim(),
        updatedAt: Date.now(),
      };

      // Save different fields based on role
      if (role === "place-owner" && placeId) {
        // Update place document in places collection
        const placeRef = doc(db, "places", placeId);
        await updateDoc(placeRef, {
          name: placeName.trim(),
          category: placeCategory,
          address: placeAddress.trim(),
          amenities: placeAmenities.trim(),
          updatedAt: Date.now(),
        });
      } else if (role !== "place-owner") {
        // Update rider profile fields
        updateData.bio = bio.trim();
        updateData.bike = bike.trim();
        updateData.homeLocation = homeLocation.trim();
        updateData.homeAddress = homeAddress.trim();
      }

      await updateDoc(userRef, updateData);

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

  async function handleRenewSponsorship() {
    if (!user?.uid) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setRenewingSponsorship(true);
    
    try {
      // For now, simulate a 30-day renewal
      // In production, this would trigger a payment flow
      const result = await renewSponsorship(user.uid, 30, {
        transactionId: `renewal-${Date.now()}`,
      });

      if (result.success) {
        Alert.alert("Success", result.message);
        // Reload sponsorship status from user document
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setSponsorshipStatus(userSnap.data().sponsorship);
        }
      } else {
        Alert.alert("Error", result.message || "Failed to renew sponsorship");
      }
    } catch (error) {
      console.error("Renewal error:", error);
      Alert.alert("Error", "Failed to renew sponsorship");
    } finally {
      setRenewingSponsorship(false);
    }
  }

  // -----------------------------------
  // MAIN PROFILE LAYOUT
  // -----------------------------------

  return (
    <CRScreen
      scroll
      padded={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >

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
            key={`avatar-${avatarUri}-${imageRefreshKey}`}
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

        {role === "place-owner" ? (
          <>
            {/* Place Owner Fields */}
            <CRLabel style={{ marginTop: theme.spacing.md }}>Place Name</CRLabel>
            <CRInput value={placeName} onChangeText={setPlaceName} />

            <CRLabel style={{ marginTop: theme.spacing.md }}>Category</CRLabel>
            <CRInput value={placeCategory} onChangeText={setPlaceCategory} />

            <CRLabel style={{ marginTop: theme.spacing.md }}>Address</CRLabel>
            <CRInput 
              value={placeAddress} 
              onChangeText={setPlaceAddress} 
              placeholder="123 Main St, City, Postcode"
            />

            <CRLabel style={{ marginTop: theme.spacing.md }}>Amenities</CRLabel>
            <CRInput 
              value={placeAmenities} 
              onChangeText={setPlaceAmenities} 
              placeholder="WiFi, Seating, Parking"
              multiline 
            />
          </>
        ) : (
          <>
            {/* Rider Fields */}
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
          </>
        )}

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

      {/* Sponsorship Section for Place Owners */}
      {role === "place-owner" && (
        <View style={styles.cardWrap}>
          <CRCard>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.md }}>
              Sponsorship Status
            </Text>
            
            {sponsorshipStatus?.isActive ? (
              <>
                <Text style={{ color: theme.colors.success || theme.colors.primary, fontSize: 14, fontWeight: '500', marginBottom: 4 }}>
                  ✓ Active
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: theme.spacing.md }}>
                  Valid until {sponsorshipStatus.validTo ? new Date(sponsorshipStatus.validTo).toLocaleDateString() : 'N/A'}
                </Text>
                <CRButton
                  title={renewingSponsorship ? "Renewing…" : "Renew Sponsorship"}
                  variant="primary"
                  onPress={handleRenewSponsorship}
                  loading={renewingSponsorship}
                  disabled={renewingSponsorship}
                />
              </>
            ) : (
              <>
                <Text style={{ color: theme.colors.danger || theme.colors.accentDark, fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                  No active sponsorship
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: theme.spacing.md }}>
                  Upgrade your place to increase visibility and access premium features.
                </Text>
                <CRButton
                  title="Upgrade Now"
                  variant="primary"
                  onPress={handleRenewSponsorship}
                  loading={renewingSponsorship}
                  disabled={renewingSponsorship}
                />
              </>
            )}
          </CRCard>
        </View>
      )}

      <View style={styles.cardWrap}>
      <CRCard>
        <View style={styles.actionRow}>
          <CRButton
            title={saving ? "Saving…" : "Save"}
            loading={saving}
            onPress={handleSaveProfile}
            style={[styles.actionButtonGrow, { marginRight: theme.spacing.sm }]}
          />
          <CRButton
            title="Log Out"
            variant="danger"
            onPress={logout}
            style={styles.actionButtonGrow}
          />
        </View>
      </CRCard>
      </View>

      {/* Debug Logs Section */}
      <View style={styles.cardWrap}>
        <CRCard>
          <TouchableOpacity onPress={() => setShowDebugPanel(!showDebugPanel)} style={{ paddingVertical: 8 }}>
            <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>
              Debug Logs ({debugLogs.length})
            </Text>
          </TouchableOpacity>
          
          {showDebugPanel && (
            <View style={{ marginTop: 12 }}>
              {debugLogs.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>No debug logs yet</Text>
              ) : (
                <>
                  <ScrollView 
                    nestedScrollEnabled
                    style={{ 
                      maxHeight: 300, 
                      backgroundColor: theme.colors.primaryDark,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      marginBottom: 12,
                    }}
                  >
                    {debugLogs.slice(-50).map((log, idx) => (
                      <Text 
                        key={idx} 
                        style={{ 
                          color: theme.colors.textMuted, 
                          fontSize: 10,
                          fontFamily: 'monospace',
                          marginBottom: 4,
                          lineHeight: 14,
                        }}
                      >
                        {new Date(log.timestamp).toLocaleTimeString()} [{log.tag}] {log.message}
                      </Text>
                    ))}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, paddingVertical: 8, backgroundColor: theme.colors.primary, borderRadius: 4, alignItems: 'center' }}
                      onPress={async () => {
                        const text = await exportDebugLogsAsText();
                        Clipboard.setString(text);
                        Alert.alert('Copied', 'Logs copied to clipboard');
                      }}
                    >
                      <Text style={{ color: theme.colors.bg, fontSize: 12, fontWeight: '600' }}>Copy Logs</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={{ flex: 1, paddingVertical: 8, backgroundColor: theme.colors.danger, borderRadius: 4, alignItems: 'center' }}
                      onPress={async () => {
                        await clearDebugLogs();
                        setDebugLogs([]);
                        Alert.alert('Cleared', 'Debug logs cleared');
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Clear Logs</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  actionButtonGrow: {
    flex: 1,
  },

})
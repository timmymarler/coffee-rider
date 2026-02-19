// core/screens/ProfileScreen.js

import { db } from "@/config/firebase";
import { CRButton } from "@components-ui/CRButton";
import { CRCard } from "@components-ui/CRCard";
import { CRInfoBadge } from "@components-ui/CRInfoBadge";
import { CRInput } from "@components-ui/CRInput";
import { CRLabel } from "@components-ui/CRLabel";
import { CRScreen } from "@components-ui/CRScreen";
import { AuthContext } from "@context/AuthContext";
import { useThemeControls } from "@context/ThemeContext";
import { RIDER_AMENITIES } from "@core/config/amenities/rider";
import { RIDER_CATEGORIES } from "@core/config/categories/rider";
import { RIDER_SUITABILITY } from "@core/config/suitability/rider";
import { clearDebugLogs, exportDebugLogsAsText, getDebugLogs } from "@core/utils/debugLog";
import { renewSponsorship } from "@core/utils/sponsorshipUtils";
import { uploadImage } from "@core/utils/uploadImage";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import theme from "@themes";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Clipboard, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Picker } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LoginScreen from "../auth/login";
import RegisterScreen from "../auth/register";


export default function ProfileScreen() {

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, loading, logout, refreshProfile, isGuest, exitGuestMode } = useContext(AuthContext);
  const [showRegisterScreen, setShowRegisterScreen] = useState(false);
  const { brand: currentBrand, setBrand } = useThemeControls();

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
  const [placeAmenities, setPlaceAmenities] = useState([]);
  const [placeSuitability, setPlaceSuitability] = useState([]);

  // Track changes for Save button
  const [initialValues, setInitialValues] = useState({});
  
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
    if (role !== "place-owner" || !profile?.linkedPlaceId) {
      // For riders, set initial values
      setInitialValues({
        displayName: displayName,
        bio: bio,
        bike: bike,
        homeLocation: homeLocation,
        homeAddress: homeAddress,
      });
      return;
    }

    // Real-time listener for place data updates
    const placeRef = doc(db, "places", profile.linkedPlaceId);
    const unsubscribe = onSnapshot(placeRef, (placeSnap) => {
      if (placeSnap.exists()) {
        const data = placeSnap.data();
        console.log("[ProfileScreen] 📍 Place updated:", {
          placeId: profile.linkedPlaceId,
          name: data.name,
          category: data.category,
          amenities: data.amenities,
          suitability: data.suitability,
        });
        setPlaceName(data.name || "");
        setPlaceCategory(data.category || "cafe");
        setPlaceAddress(data.address || "");
        // Handle amenities - can be array or empty
        setPlaceAmenities(Array.isArray(data.amenities) ? data.amenities : []);
        // Handle suitability - can be array or empty
        setPlaceSuitability(Array.isArray(data.suitability) ? data.suitability : []);

        // Set initial values for change tracking
        setInitialValues({
          displayName: displayName,
          placeName: data.name || "",
          placeCategory: data.category || "cafe",
          placeAddress: data.address || "",
          placeAmenities: Array.isArray(data.amenities) ? data.amenities : [],
          placeSuitability: Array.isArray(data.suitability) ? data.suitability : [],
        });
      }
    }, (error) => {
      // Ignore permission errors when user is logging out
      if (error.code === 'permission-denied') {
        console.log("[ProfileScreen] Permission denied on place listener - user likely logging out");
      } else {
        console.error("[ProfileScreen] Error listening to place data:", error);
      }
    });

    return () => unsubscribe();
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
      if (role === "place-owner" && user?.uid && !isGuest) {
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
  }, [profile, role, user?.uid, isGuest]);

  const email = user?.email || "";
  const role = profile?.role || "user";

  if (loading) {
    return null;
  }

  if (!user && !isGuest) {
    return <LoginScreen />;
  }

  // Handle guest mode: show login/register options
  if (isGuest && !user) {
    // Show RegisterScreen directly if user clicked "Create Account"
    if (showRegisterScreen) {
      return <RegisterScreen onBack={() => setShowRegisterScreen(false)} />;
    }

    return (
      <CRScreen>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={styles.heading}>Welcome to Coffee Rider</Text>
              <Text style={[styles.subText, { marginBottom: theme.spacing.lg }]}>
                Sign in to save your favorite routes and manage your profile
              </Text>
              
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => {
                  exitGuestMode();
                  // By exiting guest mode and having no user, the app will show LoginScreen
                }}
              >
                <Text style={styles.loginButtonText}>Log In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.registerButton]}
                onPress={() => {
                  // Show RegisterScreen directly in guest mode
                  setShowRegisterScreen(true);
                }}
              >
                <Text style={[styles.registerButtonText]}>Create Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: theme.spacing.lg }}
                onPress={() => {
                  // Just close the profile view and return to browsing - don't exit guest mode
                  router.back();
                }}
              >
                <Text style={[styles.subText, { color: theme.colors.accentMid }]}>
                  Continue Browsing
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </CRScreen>
    );
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
  // Handle Theme Change
  // -----------------------------------
  const handleThemeChange = async (newTheme) => {
    if (!user) return;

    try {
      setBrand(newTheme);
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        selectedTheme: newTheme,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("Error saving theme preference:", error);
      Alert.alert("Error", "Failed to save theme preference");
    }
  };

  // -----------------------------------
  // Check if there are unsaved changes
  // -----------------------------------
  const hasChanges = () => {
    if (role === "place-owner") {
      return (
        displayName !== initialValues.displayName ||
        placeName !== initialValues.placeName ||
        placeCategory !== initialValues.placeCategory ||
        placeAddress !== initialValues.placeAddress ||
        JSON.stringify(placeAmenities) !== JSON.stringify(initialValues.placeAmenities) ||
        JSON.stringify(placeSuitability) !== JSON.stringify(initialValues.placeSuitability)
      );
    } else {
      return (
        displayName !== initialValues.displayName ||
        bio !== initialValues.bio ||
        bike !== initialValues.bike ||
        homeLocation !== initialValues.homeLocation ||
        homeAddress !== initialValues.homeAddress
      );
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
      const email = user?.email || "";
      const role = profile?.role || "user";
      const userRef = doc(db, "users", user.uid);
      
      const updateData = {
        displayName: displayName.trim(),
        updatedAt: Date.now(),
      };

      console.log("[ProfileScreen] Starting save - User:", user.uid, "Role:", role, "PlaceId:", placeId);

      // Save different fields based on role
      if (role === "place-owner" && placeId) {
        // Update place document in places collection
        const placeRef = doc(db, "places", placeId);
        const placeUpdateData = {
          name: placeName.trim(),
          category: placeCategory,
          address: placeAddress.trim(),
          amenities: placeAmenities, // Now stored as array
          suitability: placeSuitability, // Now stored as array
          updatedAt: Date.now(),
        };
        console.log("[ProfileScreen] Updating place document:", placeId);
        console.log("[ProfileScreen] Place data:", placeUpdateData);
        await updateDoc(placeRef, placeUpdateData);
        console.log("[ProfileScreen] ✓ Place document updated successfully");
      } else if (role !== "place-owner") {
        // Update rider profile fields
        updateData.bio = bio.trim();
        updateData.bike = bike.trim();
        updateData.homeLocation = homeLocation.trim();
        updateData.homeAddress = homeAddress.trim();
        console.log("[ProfileScreen] Updating as rider");
      } else {
        console.warn("[ProfileScreen] ⚠️  Place owner but no placeId:", { role, placeId });
      }

      // Only save displayName for place owners (rest goes to place doc)
      if (role !== "place-owner" || displayName !== initialValues.displayName) {
        console.log("[ProfileScreen] Updating user document");
        console.log("[ProfileScreen] User data:", updateData);
        await updateDoc(userRef, updateData);
        console.log("[ProfileScreen] ✓ User document updated successfully");
      } else {
        console.log("[ProfileScreen] Skipping user update (place owner, no name change)");
      }

      // Update initial values to match current state
      setInitialValues({
        displayName: displayName,
        ...(role === "place-owner" ? {
          placeName: placeName,
          placeCategory: placeCategory,
          placeAddress: placeAddress,
          placeAmenities: placeAmenities,
          placeSuitability: placeSuitability,
        } : {
          bio: bio,
          bike: bike,
          homeLocation: homeLocation,
          homeAddress: homeAddress,
        }),
      });

      await refreshProfile();
      setSaving(false);

      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
      console.log("[ProfileScreen] ✓ Save complete");
    } catch (err) {
      console.error("[ProfileScreen] ✗ Save error:", err);
      Alert.alert("Save Error", err.message || "Failed to save profile");
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

        {/* Theme Selector */}
        <CRLabel style={{ marginTop: theme.spacing.md }}>App Theme</CRLabel>
        <View style={{
          backgroundColor: theme.colors.inputBg,
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          marginVertical: theme.spacing.sm,
        }}>
          <Picker
            selectedValue={currentBrand}
            onValueChange={(itemValue) => handleThemeChange(itemValue)}
            style={{
              color: theme.colors.text,
              height: 50,
            }}
          >
            <Picker.Item label="Rider" value="rider" />
            <Picker.Item label="Driver" value="driver" />
            <Picker.Item label="Strider" value="strider" />
          </Picker>
        </View>

        {role === "place-owner" ? (
          <>
            {/* Place Owner Fields */}
            <CRLabel style={{ marginTop: theme.spacing.md }}>Place Name</CRLabel>
            <CRInput value={placeName} onChangeText={setPlaceName} />

            <CRLabel style={{ marginTop: theme.spacing.md }}>Category</CRLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: theme.spacing.sm }}
            >
              <View style={{ flexDirection: "row", gap: theme.spacing.sm, paddingRight: theme.spacing.lg }}>
                {RIDER_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setPlaceCategory(cat.key)}
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      backgroundColor:
                        placeCategory === cat.key
                          ? theme.colors.accentMid
                          : theme.colors.inputBg,
                      borderWidth: placeCategory === cat.key ? 2 : 1,
                      borderColor:
                        placeCategory === cat.key
                          ? theme.colors.accentMid
                          : theme.colors.inputBorder,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          placeCategory === cat.key
                            ? theme.colors.primaryDark
                            : theme.colors.text,
                        fontWeight: placeCategory === cat.key ? "600" : "500",
                      }}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <CRLabel style={{ marginTop: theme.spacing.md }}>Address</CRLabel>
            <CRInput 
              value={placeAddress} 
              onChangeText={setPlaceAddress} 
              placeholder="123 Main St, City, Postcode"
            />

            <CRLabel style={{ marginTop: theme.spacing.md }}>Suitability</CRLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginVertical: theme.spacing.sm }}>
              {RIDER_SUITABILITY.map((suit) => {
                const isSelected = placeSuitability.includes(suit.key);
                const iconMap = {
                  bikers: "motorbike",
                  scooters: "moped",
                  cyclists: "bicycle",
                };
                return (
                  <TouchableOpacity
                    key={suit.key}
                    onPress={() => {
                      setPlaceSuitability((prev) =>
                        isSelected
                          ? prev.filter((s) => s !== suit.key)
                          : [...prev, suit.key]
                      );
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      backgroundColor: isSelected
                        ? theme.colors.accentMid
                        : theme.colors.inputBg,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? theme.colors.accentMid
                        : theme.colors.inputBorder,
                      gap: theme.spacing.xs,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={iconMap[suit.key] || "check"}
                      size={18}
                      color={isSelected ? theme.colors.primaryDark : theme.colors.text}
                    />
                    <Text
                      style={{
                        color: isSelected
                          ? theme.colors.primaryDark
                          : theme.colors.text,
                        fontWeight: isSelected ? "600" : "500",
                        fontSize: 13,
                      }}
                    >
                      {suit.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <CRLabel style={{ marginTop: theme.spacing.md }}>Amenities</CRLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginVertical: theme.spacing.sm }}>
              {RIDER_AMENITIES.map((amenity) => {
                const isSelected = placeAmenities.includes(amenity.key);
                const iconMap = {
                  parking: "parking",
                  outdoor_seating: "table-picnic",
                  toilets: "toilet",
                  disabled_access: "wheelchair-accessibility",
                  pet_friendly: "dog-side",
                  ev_charger: "ev-plug-ccs2",
                };
                return (
                  <TouchableOpacity
                    key={amenity.key}
                    onPress={() => {
                      setPlaceAmenities((prev) =>
                        isSelected
                          ? prev.filter((a) => a !== amenity.key)
                          : [...prev, amenity.key]
                      );
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      backgroundColor: isSelected
                        ? theme.colors.accentMid
                        : theme.colors.inputBg,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? theme.colors.accentMid
                        : theme.colors.inputBorder,
                      gap: theme.spacing.xs,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={iconMap[amenity.key] || "check"}
                      size={18}
                      color={isSelected ? theme.colors.primaryDark : theme.colors.text}
                    />
                    <Text
                      style={{
                        color: isSelected
                          ? theme.colors.primaryDark
                          : theme.colors.text,
                        fontWeight: isSelected ? "600" : "500",
                        fontSize: 13,
                      }}
                    >
                      {amenity.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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

            {/* Route Theme Selector - Hidden for now */}
            {/* <View style={{ marginTop: theme.spacing.lg }}>
              <RouteThemeSelector />
            </View> */}
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
                  Valid until {
                    sponsorshipStatus.validTo 
                      ? new Date(
                          typeof sponsorshipStatus.validTo === 'object' && sponsorshipStatus.validTo.toMillis
                            ? sponsorshipStatus.validTo.toMillis()
                            : sponsorshipStatus.validTo
                        ).toLocaleDateString()
                      : 'N/A'
                  }
                </Text>
                {/* Show button with disabled state based on days remaining */}
                {sponsorshipStatus.validTo && (() => {
                  const validToMs = typeof sponsorshipStatus.validTo === 'object' && sponsorshipStatus.validTo.toMillis
                    ? sponsorshipStatus.validTo.toMillis()
                    : sponsorshipStatus.validTo;
                  const daysRemaining = (validToMs - Date.now()) / (24 * 60 * 60 * 1000);
                  const isExpiringSoon = daysRemaining < 30;
                  
                  return (
                    <CRButton
                      title={renewingSponsorship ? "Renewing…" : "Renew Sponsorship"}
                      variant="primary"
                      onPress={handleRenewSponsorship}
                      loading={renewingSponsorship}
                      disabled={renewingSponsorship || !isExpiringSoon}
                    />
                  );
                })()}
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
            variant="accentMid"
            loading={saving}
            onPress={handleSaveProfile}
            disabled={saving || !hasChanges()}
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
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  subText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  loginButton: {
    backgroundColor: theme.colors.accentMid,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: "center",
    width: "100%",
    marginBottom: theme.spacing.md,
  },
  loginButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 16,
    fontWeight: "600",
  },
  registerButton: {
    borderWidth: 2,
    borderColor: theme.colors.accentMid,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: "center",
    width: "100%",
  },
  registerButtonText: {
    color: theme.colors.accentMid,
    fontSize: 16,
    fontWeight: "600",
  },
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
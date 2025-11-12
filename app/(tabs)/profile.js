import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { getAuth, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../config/firebase";
import { uploadImageAsync } from "../../utils/uploadImage";

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState(null);
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ text: "", color: "#34C759", icon: "checkmark-circle" });
  const bannerAnim = useState(new Animated.Value(0))[0];

  // Simple banner animation
  const showBanner = (message, color = "#34C759", icon = "checkmark-circle") => {
    setBanner({ text: message, color, icon });
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  // Fetch user and profile data
  useEffect(() => {
    const loadProfile = async () => {
      const u = getAuth().currentUser;
      console.log("Current user in profile:", u?.email);

      if (!u) {
        setLoading(false);
        return;
      }

      setEmail(u.email || "");

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setDisplayName(data.displayName || "");
          setBio(data.bio || "");
          setPhotoURL(data.photoURL || u.photoURL || null);
          setRole(data.role || "user");
        } else {
          // if doc missing, make a basic one
          await setDoc(ref, { email: u.email, role: "user" });
          setRole("user");
        }
      } catch (err) {
        console.error("Profile load error:", err);
        showBanner("Error loading profile", "#FF3B30", "alert-circle");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Upload and set profile photo
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType ? [ImagePicker.MediaType.IMAGE] : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;

      const localUri = result.assets[0].uri;
      const path = `profiles/${auth.currentUser.uid}.jpg`;
      const downloadURL = await uploadImageAsync(localUri, path);

      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      await setDoc(doc(db, "users", auth.currentUser.uid), { photoURL: downloadURL }, { merge: true });

      setPhotoURL(downloadURL);
      showBanner("Photo updated", "#34C759", "checkmark-circle");
    } catch (err) {
      console.error("Photo upload error:", err);
      Alert.alert("Photo upload failed", "Please try again");
    }
  };

  const handleSave = async () => {
    const u = getAuth().currentUser;
    if (!u) return;
    try {
      setSaving(true);
      await setDoc(
        doc(db, "users", u.uid),
        {
          displayName,
          bio,
          email: u.email,
          photoURL,
        },
        { merge: true }
      );
      showBanner("Profile updated", "#34C759", "checkmark-circle");
    } catch (err) {
      console.error("Save error:", err);
      showBanner("Error saving profile", "#FF3B30", "alert-circle");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007aff" />
      </View>
    );
  }

  const user = getAuth().currentUser;

  // 👇 ADD THIS GUEST CHECK
  if (!user) {
    return (
      <View style={[styles.center, { padding: 24, backgroundColor: "#fff" }]}>
        <Ionicons name="person-circle-outline" size={100} color="#ccc" />
        <Text style={{ fontSize: 18, fontWeight: "600", marginVertical: 10 }}>
          You’re not signed in
        </Text>
        <Text style={{ color: "#666", textAlign: "center", marginBottom: 20 }}>
          Sign in to manage your profile, add cafés, and save routes.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/auth")}
          style={{
            backgroundColor: "#007aff",
            paddingVertical: 14,
            paddingHorizontal: 30,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Sign In / Register
          </Text>
        </TouchableOpacity>
      </View>
    );
  }


  return (
    <ScrollView style={styles.container}>
      {/* Banner */}
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              },
            ],
            backgroundColor: banner.color,
          },
        ]}
      >
        <Ionicons name={banner.icon} size={22} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.bannerText}>{banner.text}</Text>
      </Animated.View>

      {/* Photo */}
      <View style={styles.photoSection}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.profilePhoto} />
        ) : (
          <View style={styles.placeholderPhoto}>
            <Ionicons name="person-circle-outline" size={100} color="#ccc" />
          </View>
        )}
        <TouchableOpacity onPress={pickPhoto} style={styles.changePhotoButton}>
          <Ionicons name="camera-outline" size={18} color="#007aff" />
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Display name */}
      <View style={styles.profileRow}>
        <Ionicons name="person-outline" size={20} color="#007aff" style={styles.profileIcon} />
        <TextInput
          style={styles.profileText}
          placeholder="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
        />
      </View>

      {/* Email */}
      <View style={styles.profileRow}>
        <Ionicons name="mail-outline" size={20} color="#007aff" style={styles.profileIcon} />
        <Text style={styles.profileText}>{email}</Text>
      </View>

      {/* Bio */}
      <View style={styles.profileRow}>
        <Ionicons name="information-circle-outline" size={20} color="#007aff" style={styles.profileIcon} />
        <TextInput
          style={[styles.profileText, { flex: 1 }]}
          placeholder="Add a short bio"
          multiline
          value={bio}
          onChangeText={setBio}
        />
      </View>

      {/* Role display */}
      <View style={styles.profileRow}>
        <Ionicons name="key-outline" size={20} color="#007aff" style={styles.profileIcon} />
        <Text style={styles.profileText}>Role: {role}</Text>
      </View>

      {/* Save */}
      <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveButton, { opacity: saving ? 0.6 : 1 }]}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Profile</Text>}
      </TouchableOpacity>

      {/* Sign out */}
      {user && (
        <TouchableOpacity
          onPress={async () => {
            await signOut(auth);
            router.replace("/auth");
          }}
          style={[styles.saveButton, { backgroundColor: "#ff3b30", marginTop: 10 }]}
        >
          <Text style={styles.saveButtonText}>Sign Out</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    zIndex: 10,
  },
  bannerText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  photoSection: { alignItems: "center", marginBottom: 20 },
  profilePhoto: { width: 120, height: 120, borderRadius: 60, marginBottom: 10 },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  changePhotoButton: { flexDirection: "row", alignItems: "center" },
  changePhotoText: { color: "#007aff", marginLeft: 6, fontWeight: "500" },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  profileIcon: { marginRight: 10 },
  profileText: { fontSize: 16, color: "#333", fontWeight: "500", flex: 1 },
  saveButton: {
    backgroundColor: "#007aff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

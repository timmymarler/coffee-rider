// core/auth/register.js
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState, useContext } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "@config/firebase";
import theme from "@themes";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import AuthLayout from "./AuthLayout";
import { AuthContext } from "@/core/context/AuthContext";

const ROLES = [
  { id: "rider", label: "Rider", description: "Find coffee stops" },
  { id: "place-owner", label: "Place Owner", description: "Manage your café" },
  { id: "pro", label: "Pro", description: "Rider + full features" },
];

export default function RegisterScreen({ onBack }) {
  const router = useRouter();
  const { colors, spacing } = theme;
  const { enterGuestMode } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState("rider");
  const [placeName, setPlaceName] = useState("");
  const [placeCategory, setPlaceCategory] = useState("cafe");


  async function handleRegister() {
    if (!displayName.trim() || !email || !password || !confirmPassword) {
      Alert.alert("Missing details", "Please complete all fields.");
      return;
    }

    if (selectedRole === "place-owner" && !placeName.trim()) {
      Alert.alert("Missing place info", "Please enter your place name.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      
      const user = userCredential.user;

      const userData = {
        uid: user.uid,
        email: user.email,
        role: selectedRole,
        displayName: displayName.trim(),
        createdAt: serverTimestamp(),
      };

      // Create place document if place-owner
      if (selectedRole === "place-owner") {
        // Create place document in places collection
        const placeRef = await addDoc(collection(db, "places"), {
          name: placeName.trim(),
          category: placeCategory,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          location: {
            latitude: 0,
            longitude: 0, // Default location, user can update from profile
          },
          // Initialize empty suitability and amenities
          suitability: {},
          amenities: {},
        });

        // Store reference to place in user document
        userData.linkedPlaceId = placeRef.id;
      }

      await setDoc(doc(db, "users", user.uid), userData);
      
      setSubmitting(false);
      router.replace("/profile");
    } catch (err) {
      console.error("Register error:", err);
      setSubmitting(false);
      Alert.alert(
        "Registration failed",
        err.message || "Please try again."
      );
    }
  }

  async function handleGuestMode() {
    try {
      await enterGuestMode();
      router.replace("/map");
    } catch (err) {
      console.error("Guest mode error:", err);
      Alert.alert(
        "Error",
        "Could not enter guest mode. Please try again."
      );
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join Coffee Rider"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Display Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How others see you"
              autoCapitalize="words"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          {/* Role Selection */}
          <View style={styles.field}>
            <Text style={styles.label}>What's your role?</Text>
            <View style={styles.roleContainer}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.roleButton,
                    selectedRole === role.id && styles.roleButtonActive,
                  ]}
                  onPress={() => setSelectedRole(role.id)}
                >
                  <Text
                    style={[
                      styles.roleLabel,
                      selectedRole === role.id && styles.roleLabelActive,
                    ]}
                  >
                    {role.label}
                  </Text>
                  <Text
                    style={[
                      styles.roleDescription,
                      selectedRole === role.id && styles.roleDescriptionActive,
                    ]}
                  >
                    {role.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Conditional place owner fields */}
          {selectedRole === "place-owner" && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Place Name</Text>
                <TextInput
                  value={placeName}
                  onChangeText={setPlaceName}
                  placeholder="Your café or business name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryContainer}>
                  {["cafe", "roastery", "restaurant", "bar"].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryButton,
                        placeCategory === cat && styles.categoryButtonActive,
                      ]}
                      onPress={() => setPlaceCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          placeCategory === cat && styles.categoryTextActive,
                        ]}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.button,
              submitting && { opacity: 0.7 },
            ]}
            disabled={submitting}
            onPress={handleRegister}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </TouchableOpacity>

          {/* Back to login */}
          <TouchableOpacity
            onPress={onBack || (() => router.push("login"))}
            style={{ marginTop: spacing.md, alignItems: "center" }}
          >
            <Text style={styles.linkText}>
              Already have an account? Log in
            </Text>
          </TouchableOpacity>

          {/* Continue as Guest */}
          <TouchableOpacity
            onPress={handleGuestMode}
            style={{ marginTop: spacing.lg, alignItems: "center" }}
          >
            <Text style={[styles.linkText, { color: colors.textMuted }]}>
              Continue as Guest
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </ScrollView>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 4,
    fontWeight: "600",
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.inputText,
  },
  roleContainer: {
    flexDirection: "column",
    gap: 8,
  },
  roleButton: {
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.inputBackground,
  },
  roleButtonActive: {
    borderColor: theme.colors.accentMid,
    backgroundColor: theme.colors.accentLight + "20",
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
  },
  roleLabelActive: {
    color: theme.colors.accentMid,
  },
  roleDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  roleDescriptionActive: {
    color: theme.colors.text,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
  },
  categoryButtonActive: {
    borderColor: theme.colors.accentMid,
    backgroundColor: theme.colors.accentMid + "20",
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.text,
  },
  categoryTextActive: {
    color: theme.colors.accentMid,
  },
  button: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.accentMid,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  buttonText: {
    color: theme.colors.primaryDark,
    fontSize: 16,
    fontWeight: "600",
  },
  linkText: {
    color: theme.colors.accentMid,
    fontSize: 14,
    fontWeight: "500",
  },
});

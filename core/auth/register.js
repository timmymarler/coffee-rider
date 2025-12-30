// core/auth/register.js
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "@config/firebase";
import theme from "@themes";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import AuthLayout from "./AuthLayout";

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, spacing } = theme;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState("");


  async function handleRegister() {
    if (!displayName.trim() || !email || !password || !confirmPassword) {
      Alert.alert("Missing details", "Please complete all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
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
    const user = auth.currentUser;

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      role: "user",
      displayName: displayName.trim(),
      createdAt: serverTimestamp(),
    });

  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join Coffee Rider"
    >
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
          onPress={() => router.push("/auth/login")}
          style={{ marginTop: spacing.md, alignItems: "center" }}
        >
          <Text style={styles.linkText}>
            Already have an account? Log in
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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

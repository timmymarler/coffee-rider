// core/auth/register.js
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
} from "firebase/auth";
import { useContext, useEffect, useState } from "react";
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
  View
} from "react-native";

import { AuthContext } from "@/core/context/AuthContext";
import { auth, db } from "@config/firebase";
import {
  shouldShowProUpgradePrompt,
  showProUpgradePrompt,
} from "@core/utils/proUpgradePrompt";
import { reserveDisplayName } from "@firebaseLocal/users";
import theme from "@themes";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import AuthLayout from "./AuthLayout";
import { isAppleSignInAvailable, signInWithApple } from "./socialAuth";

export default function RegisterScreen({ onBack }) {
  const router = useRouter();
  const { colors, spacing } = theme;
  const { enterGuestMode } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [socialSubmitting, setSocialSubmitting] = useState(false);
  const [socialProcess, setSocialProcess] = useState(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    setAppleAvailable(isAppleSignInAvailable());
  }, []);

  async function handleAppleSignIn() {
    setSocialSubmitting(true);
    setSocialProcess('apple');
    try {
      const signInResult = await signInWithApple();
      let role = null;
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          const profileSnap = await getDoc(doc(db, "users", uid));
          role = profileSnap.exists() ? profileSnap.data()?.role : null;
        }
      } catch (profileErr) {
        console.warn("Unable to read user profile role after Apple sign-in:", profileErr);
      }

      setSocialSubmitting(false);
      setSocialProcess(null);
      router.replace("map");
      if (!signInResult?.isNewUser && shouldShowProUpgradePrompt(role)) {
        setTimeout(() => {
          showProUpgradePrompt(router);
        }, 250);
      }
    } catch (err) {
      setSocialSubmitting(false);
      setSocialProcess(null);
      if (!err.message?.includes("cancelled")) {
        Alert.alert("Sign-in Failed", err.message || "Apple sign-in failed. Please try again.");
      }
    }
  }

  async function handleRegister() {
    if (!displayName.trim() || !email || !password || !confirmPassword) {
      Alert.alert("Missing details", "Please complete all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      
      const user = userCredential.user;

      const userData = {
        uid: user.uid,
        email: user.email,
        contactEmail: normalizedEmail,
        role: "user",
        requestedRole: "user",
        displayName: displayName.trim(),
        excludeFromUserSearch: false,
        createdAt: serverTimestamp(),
      };

      console.log("Creating user with role:", userData.role, "Full userData:", userData);

      try {
        await reserveDisplayName(user.uid, displayName.trim());
      } catch (err) {
        await deleteUser(user);
        throw err;
      }

      await setDoc(doc(db, "users", user.uid), userData);

      try {
        await sendEmailVerification(user);
        console.log("Verification email sent to:", user.email);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      setSubmitting(false);

      Alert.alert(
        "Verification email sent",
        "Please check your email to verify your account before logging in.",
        [
          {
            text: "OK",
            onPress: () => {
              onBack?.();
            }
          }
        ]
      );
    } catch (err) {
      if (err?.code === "auth/email-already-in-use") {
        setSubmitting(false);
        Alert.alert(
          "Email already in use",
          "This email is already in use by an existing account."
        );
        return;
      }

      if ((err?.message || "").toLowerCase().includes("display name already taken")) {
        setSubmitting(false);
        Alert.alert("Display name taken", "Please choose another display name.");
        return;
      }

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
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
            onPress={onBack || (() => router.push("login"))}
            style={{ marginTop: spacing.md, alignItems: "center" }}
          >
            <Text style={styles.linkText}>
              Already have an account? Log in
            </Text>
          </TouchableOpacity>

          {appleAvailable && (
            <TouchableOpacity
              onPress={handleAppleSignIn}
              disabled={socialSubmitting && socialProcess === 'apple'}
              style={[styles.socialButton, styles.appleButton, { opacity: socialSubmitting && socialProcess === 'apple' ? 0.7 : 1 }]}
            >
              <MaterialCommunityIcons name="apple" size={20} color="white" style={{ marginRight: spacing.sm }} />
              <Text style={styles.socialButtonText}>
                {socialSubmitting && socialProcess === 'apple' ? 'Signing in...' : 'Sign in with Apple'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Continue as Guest */}
          <TouchableOpacity
            onPress={handleGuestMode}
            style={{ marginTop: spacing.lg, alignItems: "center" }}
          >
            <Text style={[styles.linkText, { color: colors.textMuted }]}>
              Continue as Guest
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  socialButton: {
    marginTop: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  appleButton: {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#fff",
  },
  socialButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
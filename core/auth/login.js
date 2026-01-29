// core/auth/login.js
import { AuthContext } from "@/core/context/AuthContext";
import { auth } from "@config/firebase";
import theme from "@themes";
import { useRouter } from "expo-router";
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useContext, useState } from "react";
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
import AuthLayout from "./AuthLayout";
import RegisterScreen from "./register";
import { resetPassword } from "./resetPassword";
export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing } = theme;
  const { enterGuestMode, user, emailVerified } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  async function handleResetPassword() {
    if (!email) {
      Alert.alert("Missing email", "Please enter your email address above first.");
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert(
        "Password reset sent",
        `A password reset email has been sent to ${email.trim()}. Please check your inbox.`,
      );
    } catch (err) {
      console.error("Reset password error:", err);
      Alert.alert(
        "Reset failed",
        err.message || "Could not send reset email. Please try again."
      );
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing details", "Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setSubmitting(false);
      router.replace("map");
    } catch (err) {
      console.error("Login error:", err);
      setSubmitting(false);
      Alert.alert(
        "Login failed",
        err.message || "Please check your details and try again."
      );
    }
  }

  async function handleGuestMode() {
    try {
      await enterGuestMode();
      // App will automatically show main tabs when guest mode is active
    } catch (err) {
      console.error("Guest mode error:", err);
      Alert.alert(
        "Error",
        "Could not enter guest mode. Please try again."
      );
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
      Alert.alert("Logout failed", "Please try again.");
    }
  }

  async function handleResendVerificationEmail() {
    if (!user) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    setSubmitting(true);
    try {
      await sendEmailVerification(user);
      Alert.alert(
        "Email sent",
        `A verification email has been sent to ${user.email}. Please check your inbox and spam folder.`
      );
    } catch (err) {
      console.error("Resend verification error:", err);
      Alert.alert(
        "Failed to send",
        err.message || "Could not send verification email. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // If user is logged in but email not verified, show verification prompt
  if (user && !emailVerified) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <AuthLayout
            title="Email Not Verified"
            subtitle="Check your inbox for the verification link"
          >
            <View style={{ marginVertical: spacing.lg }}>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.md }}>
                We sent a verification email to:
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: spacing.lg }}>
                {user.email}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.md }}>
                Click the link in the email to verify your account. You won't be able to access the full app until your email is verified.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.button, { backgroundColor: colors.accentMid }]}
            >
              <Text style={styles.buttonText}>Logout & Browse as Guest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResendVerificationEmail}
              disabled={submitting}
              style={{ marginTop: spacing.md, alignItems: "center" }}
            >
              <Text style={[styles.linkText, { color: colors.accent }]}>
                {submitting ? "Sending..." : "Resend Verification Email"}
              </Text>
            </TouchableOpacity>
          </AuthLayout>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (showRegister) {
    return <RegisterScreen onBack={() => setShowRegister(false)} />;
  }

  return (
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
>
  <ScrollView
    contentContainerStyle={{ flexGrow: 1 }}
    keyboardShouldPersistTaps="handled"
  >
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to Coffee Rider"
    >
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

      <TouchableOpacity
        style={[ 
          styles.button,
          submitting && { opacity: 0.7 },
        ]}
        disabled={submitting}
        onPress={handleLogin}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={colors.primaryDark} />
        ) : (
          <Text style={styles.buttonText}>Log in</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleResetPassword}
        style={{ marginTop: spacing.sm, alignItems: "center" }}
      >
        <Text style={[styles.linkText, { color: colors.accent }]}>Reset Password</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowRegister(true)}
        style={{ marginTop: spacing.md, alignItems: "center" }}
      >
        <Text style={styles.linkText}>
          Don't have an account? Register
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleGuestMode}
        style={{ marginTop: spacing.lg, alignItems: "center" }}
      >
        <Text style={[styles.linkText, { color: colors.textMuted }]}>
          Continue as Guest
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  </ScrollView>
</KeyboardAvoidingView>
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

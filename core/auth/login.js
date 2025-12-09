// core/auth/login.js
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
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

import { auth } from "@config/firebase";
import theme from "@themes";

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = theme;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing details", "Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setSubmitting(false);
      router.back();
    } catch (err) {
      console.error("Login error:", err);
      setSubmitting(false);
      Alert.alert("Login failed", err.message || "Please check your details and try again.");
    }
  }

  const bgColor = colors?.background || "#1E3B57";
  const cardColor = colors?.surface || "#1E3B57";
  const labelColor = colors?.textMuted || "#D2D9E2";
  const inputBg = colors?.inputBackground || "#FFFFFF";
  const inputBorder = colors?.inputBorder || "#8CAAB3";
  const inputText = colors?.inputText || "#1E3B57";
  const buttonBg = colors?.accentMid || "#FFD85C";
  const buttonText = colors?.primaryDark || "#1E3B57";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bgColor }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.card, { backgroundColor: cardColor }]}>
        <Text style={[styles.title, { color: colors?.text || "#FFFFFF" }]}>
          Log in
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: labelColor }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={labelColor}
            style={[
              styles.input,
              {
                backgroundColor: inputBg,
                borderColor: inputBorder,
                color: inputText,
              },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: labelColor }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={labelColor}
            style={[
              styles.input,
              {
                backgroundColor: inputBg,
                borderColor: inputBorder,
                color: inputText,
              },
            ]}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: buttonBg,
              opacity: submitting ? 0.7 : 1,
            },
          ]}
          disabled={submitting}
          onPress={handleLogin}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: buttonText }]}>
              Log in
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

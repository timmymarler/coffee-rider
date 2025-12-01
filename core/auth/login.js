// core/auth/login.js

import { PrimaryButton } from "@components-ui/Button";
import { Input } from "@components-ui/Input";
import { H1, H3 } from "@components-ui/Typography";
import { globalStyles } from "@config/globalStyles";
import { AuthContext } from "@context/AuthContext";
import { getTheme } from "@themes";
import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  const theme = getTheme();
  const router = useRouter();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setErrorMsg(null);
    setSubmitting(true);

    try {
      // Use AuthContext login(email, password) directly
      await login(email.trim(), password);

      // AuthContext will update user/profile via onAuthStateChanged.
      // Then we can route to saved routes (or map, as you prefer).
      router.replace("/saved-routes");
    } catch (err) {
      console.error("Login error:", err);
      setErrorMsg("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}
    >
      <H1 style={{ color: theme.colors.text }}>Welcome Back</H1>
      <H3 style={{ color: theme.colors.textMuted, marginBottom: 20 }}>
        Log in to continue
      </H3>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
      />

      {errorMsg && (
        <Text style={{ color: theme.colors.danger, marginTop: 10 }}>
          {errorMsg}
        </Text>
      )}

      <PrimaryButton
        label={submitting ? "Logging in..." : "Log In"}
        onPress={handleLogin}
        disabled={submitting}
        style={{ marginTop: 25 }}
      />

      <TouchableOpacity
        onPress={() => router.push("/auth/register")}
        style={{ marginTop: 20 }}
      >
        <Text style={{ color: theme.colors.primary }}>
          Need an account? Register
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...globalStyles.screenContainer,
    paddingTop: 80,
  },
});

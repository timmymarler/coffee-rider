import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import logo from "../../assets/logo.png";
import { PrimaryButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LinkText } from "../../components/ui/Text";
import { H1, H3 } from "../../components/ui/Typography";
import { globalStyles } from "../../config/globalStyles";
import { theme } from "../../config/theme";
import { AuthContext } from "../../context/AuthContext";
import { loginWithEmail } from "../../services/firebase/auth";


export default function LoginScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLocalLoading(true);
    setError("");

    try {
      await loginWithEmail(email, password);
      router.replace("/(tabs)/map"); // go to map after login
    } catch (err) {
      setError(err.message);
    }

    setLocalLoading(false);
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={logo} style={globalStyles.logo} />

      <H1 style={{ textAlign: "center", color: theme.colors.primaryLight }}>
        Coffee Rider
      </H1>

      <H3 style={{ textAlign: "center", color: theme.colors.textMuted, marginBottom: 24 }}>
        Sign in to continue
      </H3>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />

      <Input
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <PrimaryButton
        title="Login"
        onPress={handleLogin}
        loading={localLoading}
      />

      <LinkText onPress={() => router.push("/auth/register")}>
        Create an account
      </LinkText>

    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 12,
    textAlign: "center",
  }
});

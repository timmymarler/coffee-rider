import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../config/firebase";
import { useBanner } from "../../context/BannerContext";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [role, setRole] = useState("guest");
  const router = useRouter();
  const { showBanner } = useBanner();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const r = await getUserRole(user.uid);
        setRole(r);
        router.replace("/(tabs)/profile");
      } else {
        setRole("guest");
      }
    });
    return unsubscribe;
  }, []);

  async function getUserRole(uid) {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data().role || "user";
      }
      return "guest";
    } catch (err) {
      console.log("Error fetching role:", err?.message || err);
      return "guest";
    }
  }

  const handleAuth = async () => {
    if (!email || !password) {
      showBanner("Please enter email and password", "error");
      return;
    }

    setLoading(true);

    try {
      if (registerMode) {
        // REGISTER
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, "users", cred.user.uid), {
          email,
          role: "user",
          createdAt: new Date().toISOString(),
        });

        showBanner("Account created!", "success");
        router.replace("/(tabs)/profile");
        return;
      }

      // LOGIN
      await signInWithEmailAndPassword(auth, email, password);

      const userRole = await getUserRole(auth.currentUser.uid);
      setRole(userRole);

      showBanner("Welcome back!", "success");
      router.replace("/(tabs)/profile");
      return;

    } catch (err) {
      // This logs safely WITHOUT triggering the big red error screen
      console.log("LOGIN ERROR:", err?.message || err);

      // Friendly UI message for user
      showBanner("Invalid email or password", "error");

      // IMPORTANT: stop here
      return;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setRole("guest");
      showBanner("Signed out", "info");
      router.replace("/auth/login");
    } catch (err) {
      console.log("Logout error:", err?.message || err);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  const handleCancel = () => {
    router.replace("/(tabs)/map");
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        backgroundColor: "#fff",
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          marginBottom: 16,
          textAlign: "center",
          color: "#333",
        }}
      >
        {registerMode ? "Create Account" : "Login"}
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      />

      <TouchableOpacity
        onPress={handleAuth}
        disabled={loading}
        style={{
          backgroundColor: "#007AFF",
          borderRadius: 8,
          paddingVertical: 12,
          marginBottom: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {registerMode ? "Sign Up" : "Login"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setRegisterMode(!registerMode)}
        style={{ flexDirection: "row", justifyContent: "center", marginTop: 8 }}
      >
        <Ionicons
          name={registerMode ? "log-in-outline" : "person-add-outline"}
          size={20}
          color="#007AFF"
          style={{ marginRight: 5 }}
        />
        <Text style={{ color: "#007AFF" }}>
          {registerMode ? "Already have an account? Login" : "No account? Register"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleCancel}
        style={{
          marginTop: 30,
          backgroundColor: "#f2f2f2",
          paddingVertical: 10,
          borderRadius: 8,
        }}
      >
        <Text style={{ textAlign: "center", color: "#444" }}>Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

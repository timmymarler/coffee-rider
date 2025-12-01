import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/core/context/ThemeContext";
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";

import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // Load user profile
  useEffect(() => {
    async function load() {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setDisplayName(data.displayName || "");
      }
    }

    load();
  }, [user]);

  async function saveProfile() {
    if (!user) return;

    setLoading(true);

    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, { displayName });

      router.back();
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.label, { color: theme.textPrimary }]}>
        Display Name
      </Text>

      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Enter your name"
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.cardBackground,
            color: theme.textPrimary,
            borderColor: theme.cardBorder,
          },
        ]}
      />

      <TouchableOpacity
        onPress={saveProfile}
        disabled={loading}
        style={[
          styles.saveButton,
          { backgroundColor: theme.buttonPrimary, shadowColor: theme.shadow },
        ]}
      >
        <Text style={{ color: theme.buttonText, fontWeight: "600" }}>
          {loading ? "Saving…" : "Save"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  label: {
    fontSize: 16,
    marginBottom: 8,
  },

  input: {
    width: "100%",
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 20,
  },

  saveButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});

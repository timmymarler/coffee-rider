import { theme } from "@/config/theme";
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useContext, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function EditProfileScreen() {
  const { user, profile, loading } = useContext(AuthContext);
  const router = useRouter();

  const [displayName, setDisplayName] = useState(
    profile?.displayName || user?.email || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (loading || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: displayName.trim(),
      });

      // For now, just go back. ProfileScreen will pick it up next refresh / session.
      router.back();
    } catch (err) {
      console.error("Failed to update display name:", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        style={styles.input}
        placeholder="How other riders will see you"
        placeholderTextColor={theme.colors.placeholder}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={styles.buttonText}>Save changes</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },
  label: {
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 10,
  },
  button: {
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  cancel: {
    marginTop: 16,
  },
  cancelText: {
    color: theme.colors.textMuted,
    textAlign: "center",
    fontSize: 15,
  },
});

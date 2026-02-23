import { db } from "@config/firebase";
import CRInput from "@core/components/ui/CRInput";
import CRLabel from "@core/components/ui/CRLabel";
import { AuthContext } from "@core/context/AuthContext";
import { useStyles } from "@themes/index";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useContext, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function AppleEmailSetupModal() {
  const { user, needsAppleEmailSetup, completeAppleEmailSetup } =
    useContext(AuthContext);
  const { theme } = useStyles();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!displayName.trim()) {
      newErrors.displayName = "Display name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      // Update display name in Firebase Auth
      if (displayName !== user?.displayName) {
        await updateProfile(user, { displayName });
      }

      // Update Firestore user document with contactEmail (not auth email)
      // Auth email stays tied to Apple's provider for consistency
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        contactEmail: email,
        displayName,
        updatedAt: new Date().toISOString(),
      });

      completeAppleEmailSetup();
      Alert.alert("Success", "Your profile has been updated!");
    } catch (err) {
      console.error("[AppleEmailSetupModal] Error:", err);
      Alert.alert(
        "Error",
        err.message || "Failed to update profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!needsAppleEmailSetup) return null;

  return (
    <Modal
      visible={needsAppleEmailSetup}
      transparent
      animationType="slide"
      onRequestClose={() => {}}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                backgroundColor: theme.colors.background,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: theme.spacing.lg,
                paddingBottom: theme.spacing.lg + 20,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: theme.colors.intext,
                  marginBottom: theme.spacing.md,
                }}
              >
                Complete Your Profile
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.intextSecondary,
                  marginBottom: theme.spacing.lg,
                  lineHeight: 20,
                }}
              >
                We need a valid email address to add you to groups. You can also
                update your display name.
              </Text>

              <View style={{ marginBottom: theme.spacing.md }}>
                <CRLabel>Email Address</CRLabel>
                <CRInput
                  placeholder="your.email@example.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors({ ...errors, email: null });
                    }
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
                {errors.email && (
                  <Text
                    style={{
                      color: theme.colors.error,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {errors.email}
                  </Text>
                )}
              </View>

              <View style={{ marginBottom: theme.spacing.lg }}>
                <CRLabel>Display Name</CRLabel>
                <CRInput
                  placeholder="Your Name"
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text);
                    if (errors.displayName) {
                      setErrors({ ...errors, displayName: null });
                    }
                  }}
                  editable={!loading}
                />
                {errors.displayName && (
                  <Text
                    style={{
                      color: theme.colors.error,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {errors.displayName}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: theme.colors.accentMid,
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: "center",
                  opacity: loading ? 0.6 : 1,
                }}
                onPress={handleSave}
                disabled={loading}
              >
                <Text
                  style={{
                    color: theme.colors.intext,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {loading ? "Saving..." : "Save & Continue"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: theme.spacing.md }}
                onPress={() => completeAppleEmailSetup()}
                disabled={loading}
              >
                <Text
                  style={{
                    color: theme.colors.intextSecondary,
                    fontSize: 14,
                    textAlign: "center",
                  }}
                >
                  Skip for now
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

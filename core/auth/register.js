// core/auth/register.js
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { RIDER_CATEGORIES } from "@core/config/categories/rider";
import theme from "@themes";
import { addDoc, collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import AuthLayout from "./AuthLayout";

const ROLES = [
  { id: "rider", label: "Rider", description: "Find coffee stops" },
  { id: "pro", label: "Pro", description: "Rider + full features" },
  { id: "place-owner", label: "Place Owner", description: "Manage your café" },
];

export default function RegisterScreen({ onBack }) {
  const router = useRouter();
  const { colors, spacing } = theme;
  const { enterGuestMode } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState("rider");
  const [placeName, setPlaceName] = useState("");
  const [placeCategory, setPlaceCategory] = useState("cafe");
  
  // Place matching state
  const [placeMatches, setPlaceMatches] = useState([]); // Matching places found
  const [selectedPlace, setSelectedPlace] = useState(null); // Selected existing place or null for new
  const [showPlaceSelectionModal, setShowPlaceSelectionModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Search for matching places by name
  async function searchPlaces() {
    if (!placeName.trim()) {
      setPlaceMatches([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchTerm = placeName.trim().toLowerCase();
      console.log("[Register] Searching for places with name containing:", searchTerm);
      
      // Get all places and filter client-side for case-insensitive substring match
      const q = await getDocs(collection(db, "places"));
      console.log("[Register] Total places in collection:", q.docs.length);
      
      if (q.docs.length > 0) {
        console.log("[Register] Sample places:", q.docs.slice(0, 3).map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.title,
          };
        }));
      }
      
      const matches = q.docs
        .map(doc => {
          const data = doc.data();
          // Normalize place data - use name if available, fall back to title
          return {
            id: doc.id,
            ...data,
            name: data.name || data.title || "Unnamed Place",
          };
        })
        .filter(place => {
          const placeName = (place.name || place.title || "").toLowerCase();
          return placeName && placeName.includes(searchTerm);
        })
        .sort((a, b) => {
          // Sort by relevance - exact matches first, then starts with, then contains
          const aName = (a.name || a.title || "").toLowerCase();
          const bName = (b.name || b.title || "").toLowerCase();
          
          if (aName === searchTerm) return -1;
          if (bName === searchTerm) return 1;
          if (aName.startsWith(searchTerm)) return -1;
          if (bName.startsWith(searchTerm)) return 1;
          return 0;
        });
      
      console.log("[Register] Found matches:", matches.length, matches);
      setPlaceMatches(matches);

      // Always show selection modal (even if no matches found)
      console.log("[Register] Showing place selection modal");
      setShowPlaceSelectionModal(true);
    } catch (err) {
      console.error("Error searching places:", err);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleRegister() {
    if (!displayName.trim() || !email || !password || !confirmPassword) {
      Alert.alert("Missing details", "Please complete all fields.");
      return;
    }

    if (selectedRole === "place-owner" && !placeName.trim()) {
      Alert.alert("Missing place info", "Please enter your place name.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      
      const user = userCredential.user;

      const userData = {
        uid: user.uid,
        email: user.email,
        role: selectedRole,
        displayName: displayName.trim(),
        createdAt: serverTimestamp(),
      };

      console.log("Creating user with role:", selectedRole, "Full userData:", userData);

      // Create place document if place-owner
      if (selectedRole === "place-owner") {
        let placeId;
        
        // Scenario 1 & 2: Check if place was selected in modal
        if (selectedPlace) {
          // Reuse existing place (Scenario 2)
          placeId = selectedPlace.id;
          console.log("Using existing place (user selected):", placeId);
        } else {
          // Scenario 1: Create new place
          const placeRef = await addDoc(collection(db, "places"), {
            name: placeName.trim(),
            category: placeCategory,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            location: {
              latitude: 0,
              longitude: 0, // Default location, user can update from profile
            },
            // Initialize empty suitability and amenities
            suitability: {},
            amenities: {},
          });
          placeId = placeRef.id;
          console.log("Created new place:", placeId);
        }

        // Store reference to place in user document
        userData.linkedPlaceId = placeId;
      }

      await setDoc(doc(db, "users", user.uid), userData);
      
      // Send verification email
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
              // Close register modal and return to login
              onBack?.();
            }
          }
        ]
      );
    } catch (err) {
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

          {/* Role Selection */}
          <View style={styles.field}>
            <Text style={styles.label}>What's your role?</Text>
            <View style={styles.roleContainer}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.roleButton,
                    selectedRole === role.id && styles.roleButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedRole(role.id);
                    // Reset place selection if switching away from place-owner
                    if (role.id !== "place-owner") {
                      setSelectedPlace(null);
                      setPlaceMatches([]);
                      setPlaceName("");
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.roleLabel,
                      selectedRole === role.id && styles.roleLabelActive,
                    ]}
                  >
                    {role.label}
                  </Text>
                  <Text
                    style={[
                      styles.roleDescription,
                      selectedRole === role.id && styles.roleDescriptionActive,
                    ]}
                  >
                    {role.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Conditional place owner fields */}
          {selectedRole === "place-owner" && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Place Name</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={placeName}
                    onChangeText={setPlaceName}
                    placeholder="Your café or business name"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { flex: 1 }]}
                    editable={!selectedPlace} // Disable if place selected
                  />
                  {selectedRole === "place-owner" && placeName.trim() && !selectedPlace && (
                    <TouchableOpacity
                      style={styles.searchButton}
                      onPress={searchPlaces}
                      disabled={isSearching}
                    >
                      {isSearching ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <Text style={styles.searchButtonText}>Search</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {selectedPlace && (
                    <TouchableOpacity
                      style={styles.searchButton}
                      onPress={() => {
                        setSelectedPlace(null);
                        setPlaceMatches([]);
                        setPlaceName("");
                      }}
                    >
                      <Text style={styles.searchButtonText}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {selectedPlace && (
                  <Text style={styles.selectedPlaceText}>
                    ✓ Using: {selectedPlace.name}
                  </Text>
                )}
              </View>

              {/* Category - only show for new places */}
              {!selectedPlace && (
                <View style={styles.field}>
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.categoryContainer}>
                    {RIDER_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.categoryButton,
                          placeCategory === cat.key && styles.categoryButtonActive,
                        ]}
                        onPress={() => setPlaceCategory(cat.key)}
                      >
                        <Text
                          style={[
                            styles.categoryText,
                            placeCategory === cat.key && styles.categoryTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

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

      {/* Place Selection Modal */}
      <Modal
        visible={showPlaceSelectionModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowPlaceSelectionModal(false);
          setPlaceMatches([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select a Place</Text>
            <Text style={styles.modalSubtitle}>
              {placeMatches.length === 0
                ? `No places found matching "${placeName}"`
                : placeMatches.length === 1
                ? "Found an existing place. Would you like to link to it?"
                : `Found ${placeMatches.length} matching places:`}
            </Text>

            {placeMatches.length > 0 && (
              <FlatList
                data={placeMatches}
                keyExtractor={(item) => item.id}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.placeOption}
                    onPress={() => {
                      console.log("[Register] Selected place:", item.name);
                      setSelectedPlace(item);
                      setPlaceName(item.name); // Fill in the place name
                      setShowPlaceSelectionModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeOptionName}>{item.name}</Text>
                      <Text style={styles.placeOptionCategory}>
                        {item.category || "Uncategorized"}
                      </Text>
                    </View>
                    <Text style={styles.placeOptionSelect}>→</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.createNewButton}
              onPress={() => {
                setShowPlaceSelectionModal(false);
                setPlaceMatches([]);
                // selectedPlace stays null - will create new
              }}
            >
              <Text style={styles.createNewButtonText}>Create New Place</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowPlaceSelectionModal(false);
                setPlaceMatches([]);
                setPlaceName(""); // Clear place name to start over
              }}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  roleContainer: {
    flexDirection: "column",
    gap: 8,
  },
  roleButton: {
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.inputBackground,
  },
  roleButtonActive: {
    borderColor: theme.colors.accentMid,
    backgroundColor: theme.colors.accentLight + "20",
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.primaryMid,
  },
  roleLabelActive: {
    color: theme.colors.accentMid,
  },
  roleDescription: {
    fontSize: 12,
    color: theme.colors.primaryMid,
    marginTop: 2,
  },
  roleDescriptionActive: {
    color: theme.colors.text,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    minWidth: "30%",
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
  },
  categoryButtonActive: {
    borderColor: theme.colors.accentMid,
    backgroundColor: theme.colors.accentMid + "20",
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.primaryMid,
  },
  categoryTextActive: {
    color: theme.colors.accentMid,
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
  
  // Input row with search button
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  selectedPlaceText: {
    color: theme.colors.success || "#4CAF50",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },

  // Place selection modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.colors.primaryMid,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 60,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.accentDark,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  placeOption: {
    flexDirection: "row",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accentMid,
  },
  placeOptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.accentMid,
    flex: 1,
  },
  placeOptionCategory: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  placeOptionSelect: {
    fontSize: 18,
    color: theme.colors.accentMid,
    marginLeft: 8,
  },
  createNewButton: {
    backgroundColor: theme.colors.secondaryMid,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
    marginTop: 8,
  },
  createNewButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  modalCancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.accentMid,
  },
  modalCancelButtonText: {
    color: theme.colors.accentMid,
    fontSize: 14,
    fontWeight: "600",
  },});
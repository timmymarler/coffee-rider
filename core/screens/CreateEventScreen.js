// core/screens/CreateEventScreen.js
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { useEventForm } from "@core/hooks/useEventForm";
import theme from "@themes";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    DatePickerAndroid,
    DatePickerIOS,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function CreateEventScreen() {
  const router = useRouter();
  const { user, profile } = useContext(AuthContext);
  const { colors, spacing } = theme;
  const { selectedDate } = useLocalSearchParams();
  
  // Parse selectedDate if provided
  const initialDate = selectedDate ? new Date(selectedDate) : null;
  const { formData, updateForm, submitForm, submitting, error } = useEventForm(initialDate);

  const [userPlaces, setUserPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState("startDateTime"); // "startDateTime" or "endDateTime"
  
  // Place search state for Pro users
  const [placeName, setPlaceName] = useState("");
  const [placeMatches, setPlaceMatches] = useState([]);
  const [showPlaceSelectionModal, setShowPlaceSelectionModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Load places for this place owner or show search for Pro users
  useEffect(() => {
    if (profile?.role === "place-owner" && profile?.linkedPlaceId) {
      // For place owners, use their linked place from their profile
      const userPlace = {
        id: profile.linkedPlaceId,
        name: profile.displayName || "My Place",
      };
      setUserPlaces([userPlace]);
      // Auto-select their place
      updateForm("placeId", userPlace.id);
      updateForm("placeName", userPlace.name);
    }
  }, [profile, user]);

  // Search for places by name (for Pro users)
  async function searchPlaces() {
    if (!placeName.trim()) {
      setPlaceMatches([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchTerm = placeName.trim().toLowerCase();
      console.log("[CreateEvent] Searching for places with name containing:", searchTerm);
      
      // Get all places and filter client-side for case-insensitive substring match
      const q = await getDocs(collection(db, "places"));
      const matches = q.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(place => 
          place.name && place.name.toLowerCase().includes(searchTerm)
        )
        .sort((a, b) => {
          // Sort by relevance - exact matches first, then starts with, then contains
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          
          if (aName === searchTerm) return -1;
          if (bName === searchTerm) return 1;
          if (aName.startsWith(searchTerm)) return -1;
          if (bName.startsWith(searchTerm)) return 1;
          return 0;
        });
      
      console.log("[CreateEvent] Found matches:", matches.length, matches);
      setPlaceMatches(matches);

      // Show selection modal if matches found
      if (matches.length > 0) {
        console.log("[CreateEvent] Found matches - showing modal");
        setShowPlaceSelectionModal(true);
      }
    } catch (err) {
      console.error("Error searching places:", err);
    } finally {
      setIsSearching(false);
    }
  }

  // Handle place selection from search results
  function handleSelectPlace(place) {
    updateForm("placeId", place.id);
    updateForm("placeName", place.name);
    setPlaceName(""); // Clear search
    setPlaceMatches([]);
    setShowPlaceSelectionModal(false);
    console.log("[CreateEvent] Selected place:", place.name);
  }

  // Handle clearing place selection
  function handleClearPlace() {
    updateForm("placeId", null);
    updateForm("placeName", "");
    setPlaceName("");
    setPlaceMatches([]);
  }

  const handleSubmit = async () => {
    // Validate place selection for all users
    if (!formData.placeId || !formData.placeName) {
      Alert.alert("Please select a place", "You must choose a place for your event.");
      return;
    }

    // Check if place owner has active sponsorship
    if (profile?.role === "place-owner") {
      if (!profile?.linkedPlaceId) {
        Alert.alert("No place linked", "Please link a place to your account first.");
        return;
      }

      try {
        // Fetch the user document to check sponsorship
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (!userData?.sponsorship?.isActive) {
          Alert.alert(
            "Sponsorship expired",
            "Your sponsorship has expired. Please renew it to create events."
          );
          return;
        }

        // Check if sponsorship is still valid (validTo is in the future)
        const now = Date.now();
        const validTo = userData.sponsorship.validTo?.toMillis?.() || userData.sponsorship.validTo;
        if (validTo && validTo < now) {
          Alert.alert(
            "Sponsorship expired",
            "Your sponsorship has expired. Please renew it to create events."
          );
          return;
        }
      } catch (err) {
        console.error("Error checking sponsorship:", err);
        Alert.alert("Error", "Could not verify sponsorship status.");
        return;
      }
    }

    const success = await submitForm();
    if (success) {
      Alert.alert("Success", "Event created successfully!");
      router.back();
    } else {
      Alert.alert("Error", error || "Failed to create event");
    }
  };

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState("startDateTime");

  const handleDatePicker = async (field) => {
    if (Platform.OS === "android") {
      const currentDate = field === "Start Date" ? formData.startDateTime : formData.endDateTime;
      try {
        // Step 1: Pick the date
        const { action, year, month, day } = await DatePickerAndroid.open({
          date: currentDate,
          mode: "calendar",
        });
        
        if (action === DatePickerAndroid.dateSetAction) {
          // Step 2: Show modal time picker for time selection
          setTimePickerMode(field === "Start Date" ? "startDateTime" : "endDateTime");
          setShowTimePicker(true);
          // Store the picked date so we can combine it with time later
          const pickedDate = new Date(year, month, day);
          updateForm(field === "Start Date" ? "startDateTime" : "endDateTime", pickedDate);
        }
      } catch ({ code, message }) {
        console.warn("Error picking date:", message);
      }
    } else {
      // For iOS, show a modal with the date/time picker
      setDatePickerMode(field === "Start Date" ? "startDateTime" : "endDateTime");
      setShowDatePicker(true);
    }
  };

  const handleDateConfirm = (date) => {
    if (datePickerMode === "startDateTime") {
      updateForm("startDateTime", date);
    } else {
      updateForm("endDateTime", date);
    }
    setShowDatePicker(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Event</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl * 4 }}
        >
          {/* Event Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              value={formData.title}
              onChangeText={(value) => updateForm("title", value)}
              placeholder="Coffee & Cycling Meetup"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={formData.description}
              onChangeText={(value) => updateForm("description", value)}
              placeholder="Tell people about your event..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { height: 80 }]}
              multiline
            />
          </View>

          {/* Place Selection - Place Owner */}
          {profile?.role === "place-owner" && userPlaces.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Place *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                {userPlaces.map((place) => (
                  <TouchableOpacity
                    key={place.id}
                    style={[
                      styles.placeButton,
                      formData.placeId === place.id &&
                        styles.placeButtonActive,
                    ]}
                    onPress={() => {
                      updateForm("placeId", place.id);
                      updateForm("placeName", place.name);
                    }}
                  >
                    <Text
                      style={[
                        styles.placeButtonText,
                        formData.placeId === place.id &&
                          styles.placeButtonTextActive,
                      ]}
                    >
                      {place.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Place Selection - Pro User */}
          {profile?.role === "pro" && (
            <View style={styles.field}>
              <Text style={styles.label}>Place *</Text>
              
              {/* Selected Place Display */}
              {formData.placeName && (
                <View style={[styles.selectedPlaceContainer]}>
                  <Text style={styles.selectedPlaceText}>{formData.placeName}</Text>
                  <TouchableOpacity onPress={handleClearPlace}>
                    <Text style={styles.changePlaceButton}>Change</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Place Search Input */}
              {!formData.placeName && (
                <View style={styles.placeSearchContainer}>
                  <TextInput
                    value={placeName}
                    onChangeText={setPlaceName}
                    placeholder="Search for a place..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.placeSearchInput}
                  />
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={searchPlaces}
                    disabled={isSearching || !placeName.trim()}
                  >
                    <Text style={styles.searchButtonText}>
                      {isSearching ? "Searching..." : "Search"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* No Places Message - Place Owner */}
          {profile?.role === "place-owner" && userPlaces.length === 0 && (
            <View style={[styles.field, { backgroundColor: colors.inputBackground, padding: 12, borderRadius: 8 }]}>
              <Text style={styles.label}>Place not linked</Text>
              <Text style={[styles.placeButtonText, { marginTop: 8 }]}>
                You haven't linked a place yet. Go to your Profile and link a place from the Maps screen to create events.
              </Text>
              <TouchableOpacity
                style={[styles.button, { marginTop: 12 }]}
                onPress={() => router.push("/profile")}
              >
                <Text style={styles.buttonText}>Go to Profile</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Start Date/Time */}
          <View style={styles.field}>
            <Text style={styles.label}>Start Date & Time *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => handleDatePicker("Start Date")}
            >
              <Text style={styles.dateButtonText}>
                {formData.startDateTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* End Date/Time */}
          <View style={styles.field}>
            <Text style={styles.label}>End Date & Time *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => handleDatePicker("End Date")}
            >
              <Text style={styles.dateButtonText}>
                {formData.endDateTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Max Attendees */}
          <View style={styles.field}>
            <Text style={styles.label}>Max Attendees (optional)</Text>
            <TextInput
              value={
                formData.maxAttendees ? formData.maxAttendees.toString() : ""
              }
              onChangeText={(value) =>
                updateForm("maxAttendees", value ? parseInt(value) : null)
              }
              placeholder="Leave blank for unlimited"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          {/* Region */}
          <View style={styles.field}>
            <Text style={styles.label}>Region *</Text>
            <View style={styles.regionContainer}>
              {["Wales", "South East", "Midlands", "East of England", "North", "London"].map(
                (region) => (
                  <TouchableOpacity
                    key={region}
                    style={[
                      styles.regionButton,
                      formData.region === region &&
                        styles.regionButtonActive,
                    ]}
                    onPress={() => updateForm("region", region)}
                  >
                    <Text
                      style={[
                        styles.regionButtonText,
                        formData.region === region &&
                          styles.regionButtonTextActive,
                      ]}
                    >
                      {region}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          {/* Suitability */}
          <View style={styles.field}>
            <Text style={styles.label}>Suitable For *</Text>
            <View style={styles.suitabilityContainer}>
              {["Bikes", "Scooters", "Cars"].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.suitabilityButton,
                    formData.suitability.includes(option) &&
                      styles.suitabilityButtonActive,
                  ]}
                  onPress={() => {
                    const updated = formData.suitability.includes(option)
                      ? formData.suitability.filter((s) => s !== option)
                      : [...formData.suitability, option];
                    updateForm("suitability", updated);
                  }}
                >
                  <Text
                    style={[
                      styles.suitabilityButtonText,
                      formData.suitability.includes(option) &&
                        styles.suitabilityButtonTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recurrence */}
          <View style={styles.field}>
            <Text style={styles.label}>Recurrence</Text>
            <View style={styles.recurrenceContainer}>
              {["one-off", "weekly", "monthly"].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.recurrenceButton,
                    formData.recurrence === option &&
                      styles.recurrenceButtonActive,
                  ]}
                  onPress={() => updateForm("recurrence", option)}
                >
                  <Text
                    style={[
                      styles.recurrenceButtonText,
                      formData.recurrence === option &&
                        styles.recurrenceButtonTextActive,
                    ]}
                  >
                    {option === "one-off"
                      ? "One-Off"
                      : option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.7 }]}
            disabled={submitting}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Text style={styles.submitButtonText}>Create Event</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Place Selection Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={showPlaceSelectionModal}
        onRequestClose={() => setShowPlaceSelectionModal(false)}
      >
        <View style={styles.placeModalContainer}>
          <View style={styles.placeModalContent}>
            <View style={styles.placeModalHeader}>
              <TouchableOpacity onPress={() => setShowPlaceSelectionModal(false)}>
                <Text style={styles.placeModalCloseButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.placeModalTitle}>Select a Place</Text>
              <View style={{ width: 30 }} />
            </View>

            <FlatList
              data={placeMatches}
              keyExtractor={(item) => item.id}
              renderItem={({ item: place }) => (
                <TouchableOpacity
                  style={styles.placeMatchItem}
                  onPress={() => handleSelectPlace(place)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.placeMatchName}>{place.name}</Text>
                    {place.category && (
                      <Text style={styles.placeMatchCategory}>
                        {place.category.charAt(0).toUpperCase() + place.category.slice(1)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.placeMatchArrow}>›</Text>
                </TouchableOpacity>
              )}
              scrollEnabled={true}
              style={{ maxHeight: "80%" }}
              contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
            />
          </View>
        </View>
      </Modal>

      {/* Date/Time Picker Modal (iOS and Android time picker) */}
      {(showDatePicker || showTimePicker) && (
        <Modal
          transparent
          animationType="slide"
          visible={showDatePicker || showTimePicker}
          onRequestClose={() => {
            setShowDatePicker(false);
            setShowTimePicker(false);
          }}
        >
          <View style={styles.datePickerModalContainer}>
            <View style={styles.datePickerContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.datePickerButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={
                  showDatePicker
                    ? datePickerMode === "startDateTime"
                      ? formData.startDateTime
                      : formData.endDateTime
                    : timePickerMode === "startDateTime"
                    ? formData.startDateTime
                    : formData.endDateTime
                }
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    if (showDatePicker) {
                      if (datePickerMode === "startDateTime") {
                        updateForm("startDateTime", selectedDate);
                      } else {
                        updateForm("endDateTime", selectedDate);
                      }
                      // Auto-close on iOS
                      if (Platform.OS === "ios") {
                        setShowDatePicker(false);
                      }
                    } else if (showTimePicker) {
                      if (timePickerMode === "startDateTime") {
                        updateForm("startDateTime", selectedDate);
                      } else {
                        updateForm("endDateTime", selectedDate);
                      }
                      // Auto-close after time selection
                      setShowTimePicker(false);
                    }
                  }
                }}
                mode={showTimePicker ? "time" : "datetime"}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.inputText,
  },
  dateButton: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateButtonText: {
    fontSize: 14,
    color: theme.colors.inputText,
  },
  placeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: theme.colors.inputBackground,
  },
  placeButtonActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  placeButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },
  placeButtonTextActive: {
    color: theme.colors.primaryDark,
  },
  regionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  regionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 6,
    backgroundColor: theme.colors.inputBackground,
  },
  regionButtonActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  regionButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },
  regionButtonTextActive: {
    color: theme.colors.primaryDark,
  },
  suitabilityContainer: {
    flexDirection: "row",
    gap: 8,
  },
  suitabilityButton: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
  },
  suitabilityButtonActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  suitabilityButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },
  suitabilityButtonTextActive: {
    color: theme.colors.primaryDark,
  },
  recurrenceContainer: {
    flexDirection: "row",
    gap: 8,
  },
  recurrenceButton: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
  },
  recurrenceButtonActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  recurrenceButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },
  recurrenceButtonTextActive: {
    color: theme.colors.primaryDark,
  },
  errorContainer: {
    backgroundColor: theme.colors.danger,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: theme.colors.accentMid,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  submitButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 16,
    fontWeight: "600",
  },
  datePickerModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  datePickerContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "70%",
  },
  datePickerHeader: {
    backgroundColor: theme.colors.primaryMid,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: theme.colors.inputBorder,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  datePickerButtonText: {
    color: theme.colors.accentMid,
    fontSize: 16,
    fontWeight: "600",
  },
  placeSearchContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  placeSearchInput: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.inputText,
  },
  searchButton: {
    backgroundColor: theme.colors.accentMid,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: "600",
  },
  selectedPlaceContainer: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.accentMid,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  selectedPlaceText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: "500",
  },
  changePlaceButton: {
    color: theme.colors.accentMid,
    fontSize: 12,
    fontWeight: "600",
  },
  placeModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  placeModalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "90%",
  },
  placeModalHeader: {
    backgroundColor: theme.colors.primaryMid,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.inputBorder,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  placeModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
  },
  placeModalCloseButton: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: "400",
    width: 30,
    textAlign: "center",
  },
  placeMatchItem: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  placeMatchName: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.text,
  },
  placeMatchCategory: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  placeMatchArrow: {
    fontSize: 18,
    color: theme.colors.accentMid,
    marginLeft: 12,
  },
});

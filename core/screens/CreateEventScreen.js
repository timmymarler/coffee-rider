// core/screens/CreateEventScreen.js
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { useAllUserGroups } from "@core/groups/hooks";
import { useEventForm } from "@core/hooks/useEventForm";
import { useEvents } from "@core/hooks/useEvents";
import { EVENT_VISIBILITY } from "@core/map/events/sharedEvents";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import theme from "@themes";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DatePickerAndroid,
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
  View
} from "react-native";

export default function CreateEventScreen() {
      const navigation = useNavigation();
    // Set header title using navigation (react-navigation)
    useEffect(() => {
      if (navigation && typeof navigation.setOptions === 'function') {
        navigation.setOptions({ title: 'Event' });
      }
    }, [navigation]);
  const router = useRouter();
  const { user, profile } = useContext(AuthContext);
  const { colors, spacing } = theme;
  const params = useLocalSearchParams();
  const { selectedDate, eventId, edit } = params;

  // Parse selectedDate if provided
  const initialDate = selectedDate ? new Date(selectedDate) : null;
  const { formData, updateForm, submitForm, submitting, error } = useEventForm(initialDate, profile?.role);
  const { updateEvent } = useEvents();

  // Track initial form state for edit mode
  const [initialFormData, setInitialFormData] = useState(null);

  // Group sharing state
  const [visibility, setVisibility] = useState(EVENT_VISIBILITY.PRIVATE);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);

  // Edit mode: fetch event data if eventId is present
  useEffect(() => {
    async function fetchEventForEdit() {
      if (eventId && edit === 'true') {
        try {
          const eventRef = doc(db, 'events', eventId);
          const eventSnap = await getDoc(eventRef);
          if (eventSnap.exists()) {
            const eventData = eventSnap.data();
            // Pre-fill form fields
            updateForm('title', eventData.title || '');
            updateForm('description', eventData.description || '');
            updateForm('placeId', eventData.placeId || '');
            updateForm('placeName', eventData.placeName || '');
            updateForm('startDateTime', eventData.startDateTime?.toDate ? eventData.startDateTime.toDate() : new Date(eventData.startDateTime));
            updateForm('endDateTime', eventData.endDateTime?.toDate ? eventData.endDateTime.toDate() : new Date(eventData.endDateTime));
            updateForm('maxAttendees', eventData.maxAttendees || null);
            updateForm('suitability', eventData.suitability || []);
            updateForm('region', eventData.region || '');
            updateForm('recurrence', eventData.recurrence || 'one-off');
            updateForm('recurrenceEndDate', eventData.recurrenceEndDate || null);
            updateForm('recurrenceDayOfWeek', eventData.recurrenceDayOfWeek || null);
            updateForm('recurrencePattern', eventData.recurrencePattern || 'date');
            updateForm('recurrenceDateOfMonth', eventData.recurrenceDateOfMonth || 1);
            updateForm('recurrenceDayOfMonth', eventData.recurrenceDayOfMonth || 1);
            updateForm('recurrenceDayOfWeekMonthly', eventData.recurrenceDayOfWeekMonthly || 3);
            updateForm('visibility', eventData.visibility || EVENT_VISIBILITY.PRIVATE);
            setVisibility(eventData.visibility || EVENT_VISIBILITY.PRIVATE);
            setSelectedGroupIds(eventData.groupIds || []);
            // Store initial form data for change detection
            setInitialFormData({
              title: eventData.title || '',
              description: eventData.description || '',
              placeId: eventData.placeId || '',
              placeName: eventData.placeName || '',
              startDateTime: eventData.startDateTime?.toDate ? eventData.startDateTime.toDate() : new Date(eventData.startDateTime),
              endDateTime: eventData.endDateTime?.toDate ? eventData.endDateTime.toDate() : new Date(eventData.endDateTime),
              maxAttendees: eventData.maxAttendees || null,
              suitability: eventData.suitability || [],
              region: eventData.region || '',
              recurrence: eventData.recurrence || 'one-off',
              recurrenceEndDate: eventData.recurrenceEndDate || null,
              recurrenceDayOfWeek: eventData.recurrenceDayOfWeek || null,
              recurrencePattern: eventData.recurrencePattern || 'date',
              recurrenceDateOfMonth: eventData.recurrenceDateOfMonth || 1,
              recurrenceDayOfMonth: eventData.recurrenceDayOfMonth || 1,
              recurrenceDayOfWeekMonthly: eventData.recurrenceDayOfWeekMonthly || 3,
              visibility: eventData.visibility || EVENT_VISIBILITY.PRIVATE,
              groupIds: eventData.groupIds || [],
            });
          }
        } catch (err) {
          console.error('Error loading event for edit:', err);
        }
      }
    }
    fetchEventForEdit();
    // If not editing, clear all fields except date/time
    if (!eventId || edit !== 'true') {
      updateForm('title', '');
      updateForm('description', '');
      updateForm('placeId', '');
      updateForm('placeName', '');
      updateForm('maxAttendees', null);
      updateForm('suitability', []);
      updateForm('region', '');
      updateForm('recurrence', 'one-off');
      updateForm('recurrenceEndDate', null);
      updateForm('recurrenceDayOfWeek', null);
      updateForm('recurrencePattern', 'date');
      updateForm('recurrenceDateOfMonth', 1);
      updateForm('recurrenceDayOfMonth', 1);
      updateForm('recurrenceDayOfWeekMonthly', 3);
      updateForm('visibility', EVENT_VISIBILITY.PRIVATE);
      setVisibility(EVENT_VISIBILITY.PRIVATE);
      setSelectedGroupIds([]);
      // Set date fields to selected date from Calendar
      if (selectedDate) {
        const date = new Date(selectedDate);
        const startDateTime = new Date(date.setHours(9, 0, 0, 0)); // Default 9:00 AM
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 hour
        updateForm('startDateTime', startDateTime);
        updateForm('endDateTime', endDateTime);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, edit]);
    // Helper: check if all required fields are filled for new event
    function isFormComplete() {
      return (
        formData.title.trim() &&
        formData.placeId &&
        formData.placeName &&
        formData.startDateTime &&
        formData.endDateTime &&
        formData.region.trim() &&
        formData.suitability.length > 0
      );
    }

    // Helper: check if form has changed in edit mode
    function isFormChanged() {
      if (!initialFormData) return false;
      // Compare all relevant fields
      return [
        'title', 'description', 'placeId', 'placeName', 'startDateTime', 'endDateTime', 'maxAttendees', 'suitability', 'region', 'recurrence', 'recurrenceEndDate', 'recurrenceDayOfWeek', 'recurrencePattern', 'recurrenceDateOfMonth', 'recurrenceDayOfMonth', 'recurrenceDayOfWeekMonthly', 'visibility', 'groupIds'
      ].some((key) => {
        if (Array.isArray(formData[key])) {
          return JSON.stringify(formData[key]) !== JSON.stringify(initialFormData[key]);
        }
        if (formData[key] instanceof Date && initialFormData[key] instanceof Date) {
          return formData[key].getTime() !== initialFormData[key].getTime();
        }
        return formData[key] !== initialFormData[key];
      });
    }
  const [groupCardExpanded, setGroupCardExpanded] = useState(false);
  const { groups } = useAllUserGroups(user?.uid);

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
      console.log("[CreateEvent] Total places in collection:", q.docs.length);
      if (q.docs.length > 0) {
        console.log("[CreateEvent] Sample places:", q.docs.slice(0, 3).map(doc => {
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
      console.log("[CreateEvent] Found matches:", matches.length, matches);
      setPlaceMatches(matches);
      // Always show selection modal (even if no matches found)
      console.log("[CreateEvent] Showing place selection modal");
      setShowPlaceSelectionModal(true);
    } catch (err) {
      console.error("Error searching places:", err);
      if (err && err.message) {
        // Log Firestore index error message to terminal for copy-paste
        console.log("[Firestore Index Error]", err.message);
      }
    } finally {
      setIsSearching(false);
    }
  }

  // Handle place selection from search results
  async function handleSelectPlace(place) {
    updateForm("placeId", place.id);
    updateForm("placeName", place.name);
    setPlaceName(""); // Clear search
    setPlaceMatches([]);
    setShowPlaceSelectionModal(false);
    console.log("[CreateEvent] Selected place:", place.name);

    // Try to get address/location from place object or Firestore
    let address = place.address;
    let location = place.location;
    // If not present, fetch from Firestore
    if (!address || !location) {
      try {
        const placeRef = doc(db, "places", place.id);
        const placeSnap = await getDoc(placeRef);
        if (placeSnap.exists()) {
          const data = placeSnap.data();
          address = address || data.address;
          location = location || data.location;
        }
      } catch (err) {
        console.warn("Could not fetch place address/location:", err);
      }
    }

    // Map address/location to region
    const region = getRegionFromAddressOrLocation(address, location);
    if (region) {
      updateForm("region", region);
    }
  }

  // Handle clearing place selection
  function handleClearPlace() {
    updateForm("placeId", null);
    updateForm("placeName", "");
    updateForm("region", "");
    setPlaceName("");
    setPlaceMatches([]);
  }
// Helper: Map address/location to region
function getRegionFromAddressOrLocation(address, location) {
  // 1. Use postcode mapping only (ignore lat/lng)
  if (!address && !location) return "";

  // 2. Fallback: postcode mapping
  if (!address && !location) return "";
  const postcodeRegionMap = [
    { prefix: ["SW", "PL", "TR", "EX", "TQ"], region: "South West" },
    { prefix: ["SE", "BR", "CR", "DA", "ME", "CT"], region: "South East" },
    { prefix: ["E", "EC", "N", "NW", "SE", "SW", "W", "WC"], region: "London" },
    { prefix: ["B", "CV", "DY", "WS", "WV"], region: "West Midlands" },
    { prefix: ["LE", "NG", "DE"], region: "East Midlands" },
    { prefix: ["CB", "CO", "IP", "NR", "PE"], region: "East of England" },
    { prefix: ["L", "M", "OL", "PR", "SK", "WA", "WN"], region: "North West" },
    { prefix: ["NE", "SR", "TS"], region: "North East" },
    { prefix: ["BD", "DN", "HD", "HG", "HU", "LS", "S", "WF", "YO"], region: "Yorkshire and the Humber" },
    { prefix: ["CF", "LD", "NP", "SA", "SY"], region: "Wales" },
    { prefix: ["AB", "DD", "EH", "FK", "G", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "TD"], region: "Scotland" },
    { prefix: ["BT"], region: "Northern Ireland" },
  ];
  let postcode = "";
  if (address) {
    const match = address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?)/i);
    if (match) {
      postcode = match[1].toUpperCase();
    }
  }
  let selectedRegion = "";
  // Special case: SY13 (Whitchurch) should be West Midlands
  if (postcode === "SY13") {
    selectedRegion = "West Midlands";
  } else if (postcode) {
    for (const entry of postcodeRegionMap) {
      if (entry.prefix.some((p) => postcode.startsWith(p))) {
        selectedRegion = entry.region;
        break;
      }
    }
  }
  if (postcode || selectedRegion) {
    console.log(`[Region Debug] Postcode: ${postcode}, Region: ${selectedRegion}`);
  }
  if (selectedRegion) {
    return selectedRegion;
  }

  // 3. Fallback: city name
  if (address && address.toLowerCase().includes("london")) return "London";
  if (address && address.toLowerCase().includes("manchester")) return "North West";
  if (address && address.toLowerCase().includes("birmingham")) return "West Midlands";
  // ...add more city mappings as needed

  return "";
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

    // If editing, update the event instead of creating a new one
    if (eventId && edit === 'true') {
      try {
        // Admins can always update
        if (profile?.role === 'admin') {
          await updateEvent(eventId, {
            ...formData,
            visibility,
            groupIds: visibility === EVENT_VISIBILITY.GROUP ? selectedGroupIds : [],
            // Optionally add admin override marker
            adminOverride: true,
          });
        } else {
          await updateEvent(eventId, {
            ...formData,
            visibility,
            groupIds: visibility === EVENT_VISIBILITY.GROUP ? selectedGroupIds : [],
          });
        }
        Alert.alert("Success", "Event updated successfully!");
        router.replace({ pathname: '/calendar' });
      } catch (err) {
        Alert.alert("Error", err.message || "Failed to update event");
      }
    } else {
      // Pass visibility and groupIds directly to submitForm to ensure they are saved
      const success = await submitForm({
        visibility,
        groupIds: visibility === EVENT_VISIBILITY.GROUP ? selectedGroupIds : [],
      });
      if (success) {
        Alert.alert("Success", "Event created successfully!");
        router.replace({ pathname: '/calendar' });
      } else {
        Alert.alert("Error", error || "Failed to create event");
      }
    }
  };

  const [editingTimeField, setEditingTimeField] = useState(null);
  const [tempHour, setTempHour] = useState("00");
  const [tempMinute, setTempMinute] = useState("00");

  const handleDatePicker = async (field) => {
    // Use selectedDate from calendar if available (from params), otherwise use current form value
    const defaultDate = initialDate || (field === "Start Date" ? formData.startDateTime : formData.endDateTime);
    try {
      const { action, year, month, day } = await DatePickerAndroid.open({
        date: defaultDate,
        mode: "calendar",
      });
      
      if (action === DatePickerAndroid.dateSetAction) {
        const newDate = new Date(year, month, day, defaultDate.getHours(), defaultDate.getMinutes());
        if (field === "Start Date") {
          updateForm("startDateTime", newDate);
        } else {
          updateForm("endDateTime", newDate);
        }
      }
    } catch ({ code, message }) {
      console.warn("Error picking date:", message);
    }
  };

  const openTimeEditor = (field) => {
    const currentDate = field === "Start Date" ? formData.startDateTime : formData.endDateTime;
    setTempHour(String(currentDate.getHours()).padStart(2, "0"));
    setTempMinute(String(currentDate.getMinutes()).padStart(2, "0"));
    setEditingTimeField(field);
  };

  const saveTime = () => {
    const hour = parseInt(tempHour);
    const minute = parseInt(tempMinute);
    
    const finalHour = isNaN(hour) ? 0 : Math.max(0, Math.min(23, hour));
    const finalMinute = isNaN(minute) ? 0 : Math.max(0, Math.min(59, minute));
    
    if (editingTimeField === "Start Date") {
      const newDate = new Date(formData.startDateTime);
      newDate.setHours(finalHour, finalMinute);
      updateForm("startDateTime", newDate);
    } else {
      const newDate = new Date(formData.endDateTime);
      newDate.setHours(finalHour, finalMinute);
      updateForm("endDateTime", newDate);
    }
    setEditingTimeField(null);
  };

  // Set screen header title dynamically using expo-router navigation options
  useEffect(() => {
    if (typeof router.setOptions === 'function') {
      router.setOptions({
        title: eventId && edit === 'true' ? 'Edit Event' : 'Create Event',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, edit]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* No page header here; rely on screen header */}
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
              style={[styles.input, { color: colors.accentMid }]}
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
              style={[styles.input, { height: 80, color: colors.accentMid }]}
              multiline
            />
          </View>


          {/* Place Selection - All except Place Owner */}
          {profile?.role !== "place-owner" && (
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

          {/* Place Selection - Place Owner only (auto-selected, not editable) */}
          {profile?.role === "place-owner" && userPlaces.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Place *</Text>
              <View style={[styles.selectedPlaceContainer]}>
                <Text style={styles.selectedPlaceText}>{userPlaces[0].name}</Text>
              </View>
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
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.dateButton, { flex: 1, marginRight: 8 }]}
                onPress={() => handleDatePicker("Start Date")}
              >
                <Text style={styles.dateButtonText}>
                  {formData.startDateTime.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeButton, { flex: 1 }]}
                onPress={() => openTimeEditor("Start Date")}
              >
                <Text style={styles.timeButtonText}>
                  {String(formData.startDateTime.getHours()).padStart(2, "0")}:
                  {String(formData.startDateTime.getMinutes()).padStart(2, "0")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* End Date/Time */}
          <View style={styles.field}>
            <Text style={styles.label}>End Date & Time *</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.dateButton, { flex: 1, marginRight: 8 }]}
                onPress={() => handleDatePicker("End Date")}
              >
                <Text style={styles.dateButtonText}>
                  {formData.endDateTime.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeButton, { flex: 1 }]}
                onPress={() => openTimeEditor("End Date")}
              >
                <Text style={styles.timeButtonText}>
                  {String(formData.endDateTime.getHours()).padStart(2, "0")}:
                  {String(formData.endDateTime.getMinutes()).padStart(2, "0")}
                </Text>
              </TouchableOpacity>
            </View>
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
              {[
                "South West",
                "South East",
                "London",
                "West Midlands",
                "East Midlands",
                "East of England",
                "North West",
                "North East",
                "Yorkshire and the Humber",
                "Wales",
                "Scotland",
                "Northern Ireland"
              ].map(
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

          {/* Visibility & Group Sharing - Updated UI */}
          <View style={styles.field}>
            <Text style={styles.label}>Event Visibility</Text>
            <View style={{ gap: 8 }}>
              {/* Private Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility === EVENT_VISIBILITY.PRIVATE && styles.visibilityOptionSelected,
                ]}
                onPress={() => setVisibility(EVENT_VISIBILITY.PRIVATE)}
              >
                <View style={styles.visibilityIconWrap}>
                  <Ionicons name="lock-closed" size={20} color={visibility === EVENT_VISIBILITY.PRIVATE ? colors.accentMid : colors.text} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Private</Text>
                  <Text style={styles.optionDesc}>Only you can see this</Text>
                </View>
                <Ionicons name={visibility === EVENT_VISIBILITY.PRIVATE ? "radio-button-on" : "radio-button-off"} size={20} color={colors.accentMid} />
              </TouchableOpacity>

              {/* Group Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility === EVENT_VISIBILITY.GROUP && styles.visibilityOptionSelected,
                ]}
                onPress={() => setVisibility(EVENT_VISIBILITY.GROUP)}
              >
                <View style={styles.visibilityIconWrap}>
                  <MaterialCommunityIcons name="account-multiple" size={20} color={visibility === EVENT_VISIBILITY.GROUP ? colors.accentMid : colors.text} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Group</Text>
                  <Text style={styles.optionDesc}>Share with selected groups</Text>
                </View>
                <Ionicons name={visibility === EVENT_VISIBILITY.GROUP ? "radio-button-on" : "radio-button-off"} size={20} color={colors.accentMid} />
              </TouchableOpacity>

              {visibility === EVENT_VISIBILITY.GROUP && (
                <View style={styles.groupSelector}>
                  {groups && groups.length > 0 ? (
                    groups.map((group) => (
                      <TouchableOpacity
                        key={group.id}
                        style={[
                          styles.groupOption,
                          selectedGroupIds.includes(group.id) && styles.groupOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedGroupIds((selected) =>
                            selected.includes(group.id)
                              ? selected.filter((id) => id !== group.id)
                              : [...selected, group.id]
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.groupOptionText,
                            selectedGroupIds.includes(group.id) && styles.groupOptionTextSelected,
                          ]}
                        >
                          {group.name}
                        </Text>
                        {selectedGroupIds.includes(group.id) && (
                          <Ionicons name="checkmark-circle" size={18} color={colors.accentMid} style={{ marginLeft: 8 }} />
                        )}
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.noGroupsText}>No groups available. Create a group first.</Text>
                  )}
                </View>
              )}

              {/* Public Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility === EVENT_VISIBILITY.PUBLIC && styles.visibilityOptionSelected,
                ]}
                onPress={() => setVisibility(EVENT_VISIBILITY.PUBLIC)}
              >
                <View style={styles.visibilityIconWrap}>
                  <Ionicons name="globe" size={20} color={visibility === EVENT_VISIBILITY.PUBLIC ? colors.accentMid : colors.text} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Public</Text>
                  <Text style={styles.optionDesc}>Anyone can see this</Text>
                </View>
                <Ionicons name={visibility === EVENT_VISIBILITY.PUBLIC ? "radio-button-on" : "radio-button-off"} size={20} color={colors.accentMid} />
              </TouchableOpacity>
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
            disabled={submitting || (eventId && edit === 'true' ? !isFormChanged() : !isFormComplete())}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Text style={styles.submitButtonText}>Save</Text>
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
              <Text style={styles.placeModalTitle}>Select a Place</Text>
              <TouchableOpacity onPress={() => setShowPlaceSelectionModal(false)}>
                <Text style={styles.placeModalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>
              {placeMatches.length === 0
                ? `No places found matching "${placeName}"`
                : placeMatches.length === 1
                ? "Found an existing place. Would you like to select it?"
                : `Found ${placeMatches.length} matching places:`}
            </Text>

            {placeMatches.length > 0 && (
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
                nestedScrollEnabled={true}
                style={{ maxHeight: 300 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Date/Time Picker Modal - Time Editor */}
      <Modal
        transparent
        animationType="slide"
        visible={editingTimeField !== null}
        onRequestClose={() => setEditingTimeField(null)}
      >
        <View style={styles.timePickerModalContainer}>
          <View style={styles.timePickerContent}>
            <View style={styles.timePickerHeader}>
              <TouchableOpacity onPress={() => setEditingTimeField(null)}>
                <Text style={styles.timePickerCloseButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.timePickerTitle}>
                Set {editingTimeField === "Start Date" ? "Start" : "End"} Time
              </Text>
              <TouchableOpacity onPress={saveTime}>
                <Text style={styles.timePickerSaveButton}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timeInputContainer}>
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeLabel}>Hour</Text>
                <TextInput
                  value={tempHour}
                  onChangeText={(val) => {
                    if (val === "") {
                      setTempHour("");
                    } else {
                      const num = parseInt(val);
                      if (!isNaN(num) && num >= 0 && num <= 23) {
                        setTempHour(String(num));
                      }
                    }
                  }}
                  onBlur={() => {
                    if (tempHour === "" || isNaN(parseInt(tempHour))) {
                      setTempHour("00");
                    } else {
                      setTempHour(String(parseInt(tempHour)).padStart(2, "0"));
                    }
                  }}
                  placeholder="00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.timeInput}
                />
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              <View style={styles.timeInputGroup}>
                <Text style={styles.timeLabel}>Minute</Text>
                <TextInput
                  value={tempMinute}
                  onChangeText={(val) => {
                    if (val === "") {
                      setTempMinute("");
                    } else {
                      const num = parseInt(val);
                      if (!isNaN(num) && num >= 0 && num <= 59) {
                        setTempMinute(String(num));
                      }
                    }
                  }}
                  onBlur={() => {
                    if (tempMinute === "" || isNaN(parseInt(tempMinute))) {
                      setTempMinute("00");
                    } else {
                      setTempMinute(String(parseInt(tempMinute)).padStart(2, "0"));
                    }
                  }}
                  placeholder="00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.timeInput}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    // --- Sharing/Visibility Styles (match SavedRoutesScreen) ---
    visibilityOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: 10,
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      borderWidth: 1,
      borderColor: "transparent",
    },
    visibilityOptionSelected: {
      backgroundColor: "rgba(255, 216, 92, 0.1)",
      borderColor: theme.colors.accentMid,
    },
    visibilityIconWrap: {
      width: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    optionTextContainer: {
      flex: 1,
      marginLeft: 12,
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    optionDesc: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    groupSelector: {
      marginLeft: 32,
      marginTop: 8,
      marginBottom: 12,
      gap: 6,
    },
    groupOption: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    groupOptionSelected: {
      backgroundColor: "rgba(255, 216, 92, 0.15)",
      borderColor: theme.colors.accentMid,
    },
    groupOptionText: {
      fontSize: 13,
      color: theme.colors.text,
    },
    groupOptionTextSelected: {
      color: theme.colors.accentMid,
      fontWeight: "600",
    },
    noGroupsText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontStyle: "italic",
      marginLeft: 32,
      marginBottom: 12,
    },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primaryMid,
    borderBottomWidth: 0,
    borderRadius: 12,
    marginBottom: 4,
    shadowColor: theme.colors.accentMid,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  closeButton: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
  },
  field: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 8,
    padding: 12,
    shadowColor: theme.colors.accentMid,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.inputText,
    marginBottom: 4,
  },
  dateButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: theme.colors.accentMid,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dateButtonText: {
    fontSize: 14,
    color: theme.colors.accentMid,
    fontWeight: "700",
  },
  placeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: theme.colors.primaryMid,
    shadowColor: theme.colors.accentMid,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
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
    color: theme.colors.primaryDark,
    fontWeight: "500",
  },
  changePlaceButton: {
    color: theme.colors.accentMid,
    fontSize: 12,
    fontWeight: "600",
  },
  placeModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  placeModalContent: {
    backgroundColor: theme.colors.primaryMid,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 60,
    maxHeight: "80%",
  },
  placeModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  placeModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.accentDark,
  },
  placeModalCloseButton: {
    fontSize: 24,
    color: theme.colors.accentMid,
    fontWeight: "400",
    width: 30,
    textAlign: "center",
  },
  placeMatchItem: {
    flexDirection: "row",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accentMid,
  },
  placeMatchName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.accentMid,
    flex: 1,
  },
  placeMatchCategory: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  placeMatchArrow: {
    fontSize: 18,
    color: theme.colors.accentMid,
    marginLeft: 8,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 8,
  },
  timeButton: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeButtonText: {
    fontSize: 14,
    color: theme.colors.inputText,
    fontWeight: "500",
    textAlign: "center",
  },
  timePickerModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
  },
  timePickerContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingVertical: theme.spacing.lg,
    maxWidth: "85%",
  },
  timePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
  },
  timePickerCloseButton: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  timePickerSaveButton: {
    color: theme.colors.accentMid,
    fontSize: 14,
    fontWeight: "600",
  },
  timeInputContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    gap: 8,
  },
  timeInputGroup: {
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 8,
    fontWeight: "500",
  },
  timeInput: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: "600",
    color: theme.colors.inputText,
    textAlign: "center",
    width: 80,
  },
  timeSeparator: {
    fontSize: 28,
    color: theme.colors.text,
    fontWeight: "600",
    marginBottom: 4,
  },
});

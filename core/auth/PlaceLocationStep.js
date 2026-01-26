// core/auth/PlaceLocationStep.js
import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const GOOGLE_KEY = Constants.expoConfig?.extra?.googlePlacesApiKey;

export default function PlaceLocationStep({
  placeName,
  placeCategory,
  onLocationSelected,
  onBack,
  isLoading,
}) {
  const [address, setAddress] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Search Google Places for the place name
  useEffect(() => {
    searchPlace();
  }, []);

  const searchPlace = async () => {
    if (!placeName.trim() || !GOOGLE_KEY) {
      console.log("[PlaceLocationStep] Missing placeName or GOOGLE_KEY");
      setShowManualEntry(true);
      return;
    }

    setSearching(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        placeName.trim()
      )}&key=${GOOGLE_KEY}`;

      console.log("[PlaceLocationStep] Searching for:", placeName.trim());
      const response = await fetch(url);
      const data = await response.json();

      console.log("[PlaceLocationStep] Search response:", data);
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results.slice(0, 5)); // Show top 5 results
        console.log("[PlaceLocationStep] Found places:", data.results.length);
      } else {
        console.log("[PlaceLocationStep] No places found, showing manual entry");
        setShowManualEntry(true);
      }
    } catch (err) {
      console.error("[PlaceLocationStep] Search error:", err);
      setShowManualEntry(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPlace = (place) => {
    console.log("[PlaceLocationStep] Place selected:", place.name);
    if (place.geometry?.location) {
      onLocationSelected({
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        address: place.formatted_address || placeName,
      });
    }
  };

  const handleGeocodeAddress = async () => {
    if (!address.trim() || !GOOGLE_KEY) {
      Alert.alert("Error", "Please enter an address");
      return;
    }

    setGeocoding(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address.trim()
      )}&key=${GOOGLE_KEY}`;

      console.log("[PlaceLocationStep] Geocoding address:", address.trim());
      const response = await fetch(url);
      const data = await response.json();

      console.log("[PlaceLocationStep] Geocode response:", data);
      
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        console.log("[PlaceLocationStep] Extracted coordinates:", location);
        
        onLocationSelected({
          latitude: location.lat,
          longitude: location.lng,
          address: data.results[0].formatted_address,
        });
      } else {
        console.log("[PlaceLocationStep] No results from geocoding");
        Alert.alert("Error", "Address not found. Please try again.");
      }
    } catch (err) {
      console.error("[PlaceLocationStep] Geocode error:", err);
      Alert.alert("Error", "Failed to find address");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Set Location for "{placeName}"</Text>
      <Text style={styles.subtitle}>
        Help others find your place by confirming its location
      </Text>

      {/* Search Results */}
      {searching ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Searching for places...</Text>
        </View>
      ) : searchResults.length > 0 && !showManualEntry ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Text style={styles.sectionTitle}>Found Places</Text>
          {searchResults.map((place, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.resultCard}
              onPress={() => {
                console.log("[PlaceLocationStep] Tapped place:", place.name);
                handleSelectPlace(place);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.resultContent}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.resultAddress} numberOfLines={2}>
                  {place.formatted_address}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.primaryLight}
              />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => {
              console.log("[PlaceLocationStep] Showing manual entry");
              setShowManualEntry(true);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="pencil"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.manualButtonText}>
              None of these? Enter address manually
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Manual Entry */}
      {showManualEntry && (
        <View>
          <Text style={styles.sectionTitle}>Enter Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Full address (street, city, country)"
            placeholderTextColor={theme.colors.textMuted}
            value={address}
            onChangeText={setAddress}
            multiline
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGeocodeAddress}
            disabled={geocoding}
          >
            {geocoding ? (
              <ActivityIndicator color={theme.colors.bg} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={20}
                  color={theme.colors.bg}
                />
                <Text style={styles.primaryButtonText}>Find Location</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              console.log("[PlaceLocationStep] Skipping location");
              onLocationSelected({
                latitude: 0,
                longitude: 0,
                address: placeName,
              });
            }}
            disabled={geocoding}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        disabled={isLoading}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
  },
  resultContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  resultName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    gap: theme.spacing.sm,
  },
  manualButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "500",
  },
  input: {
    backgroundColor: theme.colors.primaryMid,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 80,
    marginBottom: theme.spacing.lg,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  primaryButtonText: {
    color: theme.colors.bg,
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
  },
  skipButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  backButton: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
});

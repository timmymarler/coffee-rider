// core/auth/PlaceLocationStep.js
import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import Constants from "expo-constants";
import { useContext, useEffect, useState } from "react";
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
  import { AuthContext } from "@context/AuthContext";
  import { GOOGLE_PLACES_LIVE_SEARCH_ENABLED } from "@core/config/launchFlags";
  import { getCapabilities } from "@core/roles/capabilities";
  import { geocodeAddress } from "@core/lib/geocode";

const GOOGLE_KEY = Constants.expoConfig?.extra?.googlePlacesApiKey;

export default function PlaceLocationStep({
  placeName,
  placeCategory,
  onLocationSelected,
  onBack,
  isLoading,
}) {
  const auth = useContext(AuthContext);
  const role = auth?.profile?.role || "guest";
  const capabilities = getCapabilities(role);
  const canUseGooglePlaces = Boolean(capabilities?.canSearchGoogle);

  const [address, setAddress] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Search Google Places for the place name
  useEffect(() => {
    searchPlace();
  }, [canUseGooglePlaces, placeName]);

  const searchPlace = async () => {
    if (!GOOGLE_PLACES_LIVE_SEARCH_ENABLED || !placeName?.trim() || !GOOGLE_KEY || !canUseGooglePlaces) {
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
    if (!address.trim()) {
      Alert.alert("Error", "Please enter an address");
      return;
    }

    if (!canUseGooglePlaces) {
      Alert.alert("Pro feature", "Place search is available for Pro and Admin accounts.");
      return;
    }

    setGeocoding(true);
    try {
      console.log("[PlaceLocationStep] Geocoding address:", address.trim());
      const coords = await geocodeAddress(address.trim(), { allowExternalLookup: true });

      if (coords?.lat != null && coords?.lng != null) {
        onLocationSelected({
          latitude: coords.lat,
          longitude: coords.lng,
          address: address.trim(),
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
      {!canUseGooglePlaces ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Place search is available for Pro and Admin accounts.
          </Text>
        </View>
      ) : null}

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
  infoBanner: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryMid,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
  },
  infoBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.primary,
    lineHeight: 18,
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

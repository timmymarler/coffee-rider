import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import theme from "@themes";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const ROUTE_TYPES = [
  {
    id: "fast",
    icon: "speedometer",
    label: "Fast",
    desc: "Quickest path, motorways OK",
  },
  {
    id: "scenic",
    icon: "image-filter-hdr",
    label: "Scenic",
    desc: "Beautiful roads, no motorways",
  },
  {
    id: "curvy",
    icon: "sine-wave",
    label: "Curvy",
    desc: "Twisty roads, maximum windingness",
  },
  {
    id: "adventurous",
    icon: "compass-outline",
    label: "Adventurous",
    desc: "Thrilling mix of hills and curves",
  },
];

const DIRECTIONS = [
  { id: "any", label: "Any", arrow: null, isCompass: true },
  { id: "north", label: "N", arrow: "↑" },
  { id: "northeast", label: "NE", arrow: "↗" },
  { id: "east", label: "E", arrow: "→" },
  { id: "southeast", label: "SE", arrow: "↘" },
  { id: "south", label: "S", arrow: "↓" },
  { id: "southwest", label: "SW", arrow: "↙" },
  { id: "west", label: "W", arrow: "←" },
  { id: "northwest", label: "NW", arrow: "↖" },
];

const DISTANCES_KM = [20, 30, 50, 75, 100, 150, 200];

const STEP_LABELS = ["Ride Style", "Direction", "Distance"];
const GOOGLE_KEY = Constants.expoConfig?.extra?.googlePlacesApiKey;

export default function AiRoutePlannerModal({
  visible,
  onClose,
  onGenerate,
  isGenerating = false,
  currentLocation = null,
}) {
  const [step, setStep] = useState(0);
  const [routePersonality, setRoutePersonality] = useState("scenic");
  const [direction, setDirection] = useState("any");
  const [maxDistanceKm, setMaxDistanceKm] = useState(50);
  const [strictLoop, setStrictLoop] = useState(false);
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [useCustomEnd, setUseCustomEnd] = useState(false);
  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startResults, setStartResults] = useState([]);
  const [endResults, setEndResults] = useState([]);
  const [startSearching, setStartSearching] = useState(false);
  const [endSearching, setEndSearching] = useState(false);
  const [selectedStartPlace, setSelectedStartPlace] = useState(null);
  const [selectedEndPlace, setSelectedEndPlace] = useState(null);

  const searchPlaces = async (query, setSearching, setResults) => {
    const trimmed = String(query || "").trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    if (!GOOGLE_KEY) {
      Alert.alert("Search unavailable", "Google Places API key is missing.");
      return;
    }

    setSearching(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(trimmed)}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const places = Array.isArray(json?.results) ? json.results.slice(0, 5) : [];
      setResults(places.map((place) => ({
        id: place.place_id || `${place.name}-${place.formatted_address}`,
        title: place.name || "Selected place",
        subtitle: place.formatted_address || "",
        latitude: place.geometry?.location?.lat,
        longitude: place.geometry?.location?.lng,
      })).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)));
    } catch (err) {
      console.warn("[AI_ROUTE_MODAL] Place search failed:", err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const chooseCurrentAsStart = () => {
    if (!currentLocation) return;
    setSelectedStartPlace({
      id: "current-start",
      title: "Current location",
      subtitle: "Using your current GPS location",
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    });
    setStartResults([]);
    setStartQuery("Current location");
  };

  const chooseCurrentAsEnd = () => {
    if (!currentLocation) return;
    setSelectedEndPlace({
      id: "current-end",
      title: "Current location",
      subtitle: "Using your current GPS location",
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    });
    setEndResults([]);
    setEndQuery("Current location");
  };

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  const handleGenerate = () => {
    if (useCustomStart && !selectedStartPlace) {
      Alert.alert("Start point required", "Search and select a start place first.");
      return;
    }
    if (useCustomEnd && !selectedEndPlace) {
      Alert.alert("End point required", "Search and select an end place first.");
      return;
    }

    onGenerate({
      routePersonality,
      direction,
      maxDistanceKm,
      strictLoop,
      startPoint: useCustomStart ? selectedStartPlace : null,
      endPoint: useCustomEnd ? selectedEndPlace : null,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        {/* Stop tap-through on the sheet itself */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="creation"
              size={22}
              color={theme.colors.accentMid}
            />
            <Text style={styles.title}>AI Route Planner</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* ── Step indicator ── */}
          <View style={styles.stepRow}>
            {STEP_LABELS.map((label, i) => (
              <View key={i} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    i === step && styles.stepDotActive,
                    i < step && styles.stepDotDone,
                  ]}
                >
                  {i < step ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={12}
                      color={theme.colors.primaryDark}
                    />
                  ) : (
                    <Text style={styles.stepDotNum}>{i + 1}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    i === step && styles.stepLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Step 0 – Ride Style ── */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.question}>What kind of ride?</Text>
              <View style={styles.typeGrid}>
                {ROUTE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.typeCard,
                      routePersonality === t.id && styles.typeCardActive,
                    ]}
                    onPress={() => setRoutePersonality(t.id)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={t.icon}
                      size={30}
                      color={
                        routePersonality === t.id
                          ? theme.colors.primaryDark
                          : theme.colors.accentMid
                      }
                    />
                    <Text
                      style={[
                        styles.typeName,
                        routePersonality === t.id && styles.typeNameActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                    <Text style={styles.typeDesc}>{t.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => setStep(1)}
              >
                <Text style={styles.nextBtnText}>Next</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={18}
                  color={theme.colors.primaryDark}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 1 – Direction ── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.question}>Which direction?</Text>
              <View style={styles.dirGrid}>
                {DIRECTIONS.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.dirCell,
                      d.id === "any" && styles.dirCellAny,
                      direction === d.id && styles.dirCellActive,
                    ]}
                    onPress={() => setDirection(d.id)}
                    activeOpacity={0.75}
                  >
                    {d.isCompass ? (
                      <MaterialCommunityIcons
                        name="compass"
                        size={20}
                        color={
                          direction === d.id
                            ? theme.colors.primaryDark
                            : theme.colors.accentMid
                        }
                      />
                    ) : (
                      <Text
                        style={[
                          styles.dirArrow,
                          direction === d.id && styles.dirArrowActive,
                        ]}
                      >
                        {d.arrow}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.dirLabel,
                        direction === d.id && styles.dirLabelActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep(0)}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={18}
                    color={theme.colors.accentMid}
                  />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nextBtn}
                  onPress={() => setStep(2)}
                >
                  <Text style={styles.nextBtnText}>Next</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={18}
                    color={theme.colors.primaryDark}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Step 2 – Distance ── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.question}>Max distance?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.distScroll}
              >
                {DISTANCES_KM.map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[
                      styles.distChip,
                      maxDistanceKm === km && styles.distChipActive,
                    ]}
                    onPress={() => setMaxDistanceKm(km)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.distChipText,
                        maxDistanceKm === km && styles.distChipTextActive,
                      ]}
                    >
                      {km} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.distHint}>
                Approximate — TomTom will find the best loop on real roads
              </Text>

              <View style={styles.optionalCard}>
                <View style={styles.optionalRow}>
                  <View style={styles.optionalLabelWrap}>
                    <Text style={styles.optionalTitle}>Strict Loop</Text>
                    <Text style={styles.optionalSubtitle}>Uses a fuller loop arc with extra points to reduce crossovers</Text>
                  </View>
                  <Switch
                    value={strictLoop}
                    onValueChange={setStrictLoop}
                    trackColor={{ false: theme.colors.primaryMid, true: theme.colors.accentMid }}
                    thumbColor={strictLoop ? theme.colors.primaryDark : theme.colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.optionalCard}>
                <View style={styles.optionalRow}>
                  <View style={styles.optionalLabelWrap}>
                    <Text style={styles.optionalTitle}>Custom Start Point</Text>
                    <Text style={styles.optionalSubtitle}>Default: current location</Text>
                  </View>
                  <Switch
                    value={useCustomStart}
                    onValueChange={(enabled) => {
                      setUseCustomStart(enabled);
                      if (!enabled) {
                        setSelectedStartPlace(null);
                        setStartResults([]);
                        setStartQuery("");
                      }
                    }}
                    trackColor={{ false: theme.colors.primaryMid, true: theme.colors.accentMid }}
                    thumbColor={useCustomStart ? theme.colors.primaryDark : theme.colors.textMuted}
                  />
                </View>
                {useCustomStart && (
                  <View style={styles.placeSearchWrap}>
                    <View style={styles.placeSearchRow}>
                      <TextInput
                        style={styles.placeSearchInput}
                        placeholder="Search start place"
                        placeholderTextColor={theme.colors.textMuted}
                        value={startQuery}
                        onChangeText={(text) => {
                          setStartQuery(text);
                          setSelectedStartPlace(null);
                        }}
                        returnKeyType="search"
                        onSubmitEditing={() => searchPlaces(startQuery, setStartSearching, setStartResults)}
                      />
                      <TouchableOpacity
                        style={styles.placeSearchButton}
                        onPress={() => searchPlaces(startQuery, setStartSearching, setStartResults)}
                        activeOpacity={0.8}
                      >
                        {startSearching ? (
                          <ActivityIndicator size="small" color={theme.colors.primaryDark} />
                        ) : (
                          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.primaryDark} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.placeCurrentButton}
                        onPress={chooseCurrentAsStart}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="crosshairs-gps" size={16} color={theme.colors.accentMid} />
                      </TouchableOpacity>
                    </View>
                    {selectedStartPlace && (
                      <View style={styles.selectedPlaceChip}>
                        <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.success} />
                        <Text style={styles.selectedPlaceText} numberOfLines={1}>{selectedStartPlace.title}</Text>
                      </View>
                    )}
                    {startResults.length > 0 && (
                      <View style={styles.placeResultsList}>
                        {startResults.map((place) => (
                          <TouchableOpacity
                            key={place.id}
                            style={styles.placeResultItem}
                            onPress={() => {
                              setSelectedStartPlace(place);
                              setStartQuery(place.title);
                              setStartResults([]);
                            }}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.placeResultTitle} numberOfLines={1}>{place.title}</Text>
                            {!!place.subtitle && <Text style={styles.placeResultSubtitle} numberOfLines={1}>{place.subtitle}</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.optionalCard}>
                <View style={styles.optionalRow}>
                  <View style={styles.optionalLabelWrap}>
                    <Text style={styles.optionalTitle}>Custom End Point</Text>
                    <Text style={styles.optionalSubtitle}>Default: near start for route stability</Text>
                  </View>
                  <Switch
                    value={useCustomEnd}
                    onValueChange={(enabled) => {
                      setUseCustomEnd(enabled);
                      if (!enabled) {
                        setSelectedEndPlace(null);
                        setEndResults([]);
                        setEndQuery("");
                      }
                    }}
                    trackColor={{ false: theme.colors.primaryMid, true: theme.colors.accentMid }}
                    thumbColor={useCustomEnd ? theme.colors.primaryDark : theme.colors.textMuted}
                  />
                </View>
                {useCustomEnd && (
                  <View style={styles.placeSearchWrap}>
                    <View style={styles.placeSearchRow}>
                      <TextInput
                        style={styles.placeSearchInput}
                        placeholder="Search end place"
                        placeholderTextColor={theme.colors.textMuted}
                        value={endQuery}
                        onChangeText={(text) => {
                          setEndQuery(text);
                          setSelectedEndPlace(null);
                        }}
                        returnKeyType="search"
                        onSubmitEditing={() => searchPlaces(endQuery, setEndSearching, setEndResults)}
                      />
                      <TouchableOpacity
                        style={styles.placeSearchButton}
                        onPress={() => searchPlaces(endQuery, setEndSearching, setEndResults)}
                        activeOpacity={0.8}
                      >
                        {endSearching ? (
                          <ActivityIndicator size="small" color={theme.colors.primaryDark} />
                        ) : (
                          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.primaryDark} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.placeCurrentButton}
                        onPress={chooseCurrentAsEnd}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="crosshairs-gps" size={16} color={theme.colors.accentMid} />
                      </TouchableOpacity>
                    </View>
                    {selectedEndPlace && (
                      <View style={styles.selectedPlaceChip}>
                        <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.success} />
                        <Text style={styles.selectedPlaceText} numberOfLines={1}>{selectedEndPlace.title}</Text>
                      </View>
                    )}
                    {endResults.length > 0 && (
                      <View style={styles.placeResultsList}>
                        {endResults.map((place) => (
                          <TouchableOpacity
                            key={place.id}
                            style={styles.placeResultItem}
                            onPress={() => {
                              setSelectedEndPlace(place);
                              setEndQuery(place.title);
                              setEndResults([]);
                            }}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.placeResultTitle} numberOfLines={1}>{place.title}</Text>
                            {!!place.subtitle && <Text style={styles.placeResultSubtitle} numberOfLines={1}>{place.subtitle}</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {(useCustomStart || useCustomEnd) && (
                <Text style={styles.optionalHint}>
                  If start/end are too close, the planner auto-nudges end slightly to avoid routing failures.
                </Text>
              )}

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep(1)}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={18}
                    color={theme.colors.accentMid}
                  />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.generateBtn,
                    isGenerating && styles.generateBtnDisabled,
                  ]}
                  onPress={handleGenerate}
                  disabled={isGenerating}
                  activeOpacity={0.8}
                >
                  {isGenerating ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primaryDark}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="creation"
                      size={18}
                      color={theme.colors.primaryDark}
                    />
                  )}
                  <Text style={styles.generateBtnText}>
                    {isGenerating ? "Plotting…" : "Generate Route"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  sheet: {
    backgroundColor: theme.colors.primaryDark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 10,
  },

  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },

  // ── Step indicator ──
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    gap: 8,
  },

  stepItem: {
    alignItems: "center",
    flex: 1,
  },

  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primaryMid,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },

  stepDotActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },

  stepDotDone: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },

  stepDotNum: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },

  stepLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: "center",
  },

  stepLabelActive: {
    color: theme.colors.accentMid,
    fontWeight: "600",
  },

  // ── Common step layout ──
  stepContent: {
    gap: 16,
  },

  question: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },

  // ── Route type grid ──
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  typeCard: {
    width: "47%",
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: 6,
  },

  typeCardActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentLight,
  },

  typeName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  typeNameActive: {
    color: theme.colors.primaryDark,
  },

  typeDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 15,
  },

  // ── Direction grid ──
  dirGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },

  dirCell: {
    width: 62,
    height: 62,
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },

  dirCellAny: {
    width: "100%",
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },

  dirCellActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentLight,
  },

  dirArrow: {
    fontSize: 22,
    color: theme.colors.accentMid,
    fontWeight: "700",
  },

  dirArrowActive: {
    color: theme.colors.primaryDark,
  },

  dirLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },

  dirLabelActive: {
    color: theme.colors.primaryDark,
    fontWeight: "700",
  },

  // ── Distance chips ──
  distScroll: {
    gap: 10,
    paddingVertical: 4,
  },

  distChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryMid,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  distChipActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentLight,
  },

  distChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },

  distChipTextActive: {
    color: theme.colors.primaryDark,
  },

  distHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },

  optionalCard: {
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },

  optionalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  optionalLabelWrap: {
    flex: 1,
  },

  optionalTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
  },

  optionalSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  placeSearchWrap: {
    gap: 8,
  },

  placeSearchRow: {
    flexDirection: "row",
    gap: 8,
  },

  placeSearchInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    color: theme.colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },

  placeSearchButton: {
    width: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentMid,
  },

  placeCurrentButton: {
    width: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  selectedPlaceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.14)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  selectedPlaceText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text,
  },

  placeResultsList: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    overflow: "hidden",
  },

  placeResultItem: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  placeResultTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
  },

  placeResultSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  optionalHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },

  // ── Navigation buttons ──
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    gap: 6,
  },

  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },

  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: theme.colors.accentMid,
    gap: 6,
    alignSelf: "flex-end",
  },

  nextBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },

  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: theme.colors.accentMid,
    gap: 8,
    elevation: 4,
  },

  generateBtnDisabled: {
    opacity: 0.65,
  },

  generateBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },
});

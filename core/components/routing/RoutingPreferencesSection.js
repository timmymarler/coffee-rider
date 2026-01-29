import { RoutingPreferencesContext } from "@context/RoutingPreferencesContext";
import theme from "@themes";
import { useContext } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const TRAVEL_MODE_OPTIONS = [
  { id: "car", label: "🚗 Car", description: "Fastest car routes" },
  { id: "motorcycle", label: "🏍️ Motorcycle", description: "Scenic motorcycle routes" },
  { id: "bike", label: "🚴 Bike", description: "Shortest bike routes" },
  { id: "pedestrian", label: "🚶 Walking", description: "Shortest walking routes" },
];

const ROUTE_TYPE_OPTIONS = [
  { id: "fastest", label: "⚡ Fastest", description: "Minimize travel time" },
  { id: "shortest", label: "📏 Shortest", description: "Minimize distance" },
  { id: "thrilling", label: "🎢 Scenic", description: "Interesting scenic routes" },
  { id: "eco", label: "🌱 Eco", description: "Fuel-efficient routes" },
];

export default function RoutingPreferencesSection() {
  const { travelMode, setTravelMode, routeType, setRouteType, resetToDefaults } =
    useContext(RoutingPreferencesContext);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Route Preferences</Text>

      {/* Travel Mode */}
      <View style={styles.preferenceGroup}>
        <Text style={styles.preferenceName}>Transport Method</Text>
        <Text style={styles.preferenceDesc}>Choose your preferred mode of transportation</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsContainer}
        >
          {TRAVEL_MODE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionButton,
                travelMode === option.id && styles.optionButtonActive,
              ]}
              onPress={() => setTravelMode(option.id)}
            >
              <Text
                style={[
                  styles.optionLabel,
                  travelMode === option.id && styles.optionLabelActive,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  travelMode === option.id && styles.optionDescriptionActive,
                ]}
              >
                {option.description}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Route Type */}
      <View style={styles.preferenceGroup}>
        <Text style={styles.preferenceName}>Route Optimization</Text>
        <Text style={styles.preferenceDesc}>How should routes be optimized?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsContainer}
        >
          {ROUTE_TYPE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionButton,
                routeType === option.id && styles.optionButtonActive,
              ]}
              onPress={() => setRouteType(option.id)}
            >
              <Text
                style={[
                  styles.optionLabel,
                  routeType === option.id && styles.optionLabelActive,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  routeType === option.id && styles.optionDescriptionActive,
                ]}
              >
                {option.description}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Reset to Defaults */}
      <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
      </TouchableOpacity>

      {/* Current Settings Display */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Current Settings</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Transport:</Text>
          <Text style={styles.summaryValue}>
            {TRAVEL_MODE_OPTIONS.find((o) => o.id === travelMode)?.label}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Optimization:</Text>
          <Text style={styles.summaryValue}>
            {ROUTE_TYPE_OPTIONS.find((o) => o.id === routeType)?.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.primaryDark,
    marginBottom: 16,
  },
  preferenceGroup: {
    marginBottom: 20,
  },
  preferenceName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    marginBottom: 4,
  },
  preferenceDesc: {
    fontSize: 13,
    color: theme.colors.primaryMid,
    marginBottom: 12,
  },
  optionsScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  optionsContainer: {
    paddingRight: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryMid,
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: 100,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: theme.colors.accentDark,
    borderColor: theme.colors.danger,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    textAlign: "center",
  },
  optionLabelActive: {
    color: theme.colors.primaryLight,
  },
  optionDescription: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    textAlign: "center",
    marginTop: 4,
  },
  optionDescriptionActive: {
    color: theme.colors.primaryLight,
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.primaryDark,
  },
  summaryBox: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.accentDark,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.primaryMid,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 12,
    color: theme.colors.primaryLight,
    fontWeight: "600",
  },
});

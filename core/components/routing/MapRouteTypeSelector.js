import { RoutingPreferencesContext } from "@context/RoutingPreferencesContext";
import theme from "@themes";
import { useContext, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function MapRouteTypeSelector({ visible, onClose }) {
  const { 
    routeType, 
    setRouteType, 
    availableRouteTypes,
    customHilliness,
    setCustomHilliness,
    customWindingness,
    setCustomWindingness,
  } = useContext(RoutingPreferencesContext);

  const [showCustomConfigurator, setShowCustomConfigurator] = useState(false);

  if (!visible) return null;

  const levelOptions = ["low", "normal", "high"];

  const handleSelectRouteType = (id) => {
    if (id === "custom") {
      // Only show custom configurator if explicitly tapping Custom
      setRouteType(id);
      setShowCustomConfigurator(true);
    } else {
      // For other route types, select and close immediately
      setRouteType(id);
      onClose();
    }
  };

  const handleDoneCustom = () => {
    // Close the entire modal when Done is pressed from custom configurator
    setShowCustomConfigurator(false);
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          {!showCustomConfigurator ? (
            <>
              <Text style={styles.title}>Route Optimization</Text>
              <ScrollView
                style={styles.optionsScroll}
                showsVerticalScrollIndicator={false}
              >
                {availableRouteTypes.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton,
                      routeType === option.id && styles.optionButtonActive,
                    ]}
                    onPress={() => handleSelectRouteType(option.id)}
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
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Custom Route</Text>
              <ScrollView style={styles.optionsScroll}>
                <Text style={styles.configuratorLabel}>Windingness (how many turns)</Text>
                <View style={styles.levelButtonsRow}>
                  {levelOptions.map((level) => (
                    <TouchableOpacity
                      key={`wind-${level}`}
                      style={[
                        styles.levelButton,
                        customWindingness === level && styles.levelButtonActive,
                      ]}
                      onPress={() => setCustomWindingness(level)}
                    >
                      <Text
                        style={[
                          styles.levelButtonText,
                          customWindingness === level && styles.levelButtonTextActive,
                        ]}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.configuratorLabel, { marginTop: theme.spacing.lg }]}>
                  Hilliness (elevation changes)
                </Text>
                <View style={styles.levelButtonsRow}>
                  {levelOptions.map((level) => (
                    <TouchableOpacity
                      key={`hill-${level}`}
                      style={[
                        styles.levelButton,
                        customHilliness === level && styles.levelButtonActive,
                      ]}
                      onPress={() => setCustomHilliness(level)}
                    >
                      <Text
                        style={[
                          styles.levelButtonText,
                          customHilliness === level && styles.levelButtonTextActive,
                        ]}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>Your Route:</Text>
                  <Text style={styles.previewText}>
                    {customWindingness.charAt(0).toUpperCase() + customWindingness.slice(1)} Windingness, {customHilliness.charAt(0).toUpperCase() + customHilliness.slice(1)} Hilliness
                  </Text>
                </View>
              </ScrollView>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowCustomConfigurator(false)}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleDoneCustom}
                >
                  <Text style={styles.closeButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: theme.colors.cardBg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    maxHeight: "80%",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  optionsScroll: {
    marginHorizontal: -theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  optionButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.inputBg,
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
  },
  optionButtonActive: {
    backgroundColor: theme.colors.accentLight || theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  optionLabelActive: {
    color: theme.colors.accentMid,
  },
  optionDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  optionDescriptionActive: {
    color: theme.colors.accentDark || theme.colors.accentMid,
  },
  configuratorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  levelButtonsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  levelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.inputBg,
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    alignItems: "center",
  },
  levelButtonActive: {
    backgroundColor: theme.colors.accentLight || theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  levelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
  },
  levelButtonTextActive: {
    color: theme.colors.accentMid,
  },
  previewBox: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentMid,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  previewText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  backButton: {
    flex: 0.35,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.inputBg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  closeButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentMid,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primaryDark,
  },
});

import { RoutingPreferencesContext } from "@context/RoutingPreferencesContext";
import theme from "@themes";
import { useContext } from "react";
import { Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

const ROUTE_OPTIONS = [
  { id: "fastest", label: "Fastest" },
  { id: "shortest", label: "Shortest" },
  { id: "curvy", label: "Curvy" },
];
const LEVEL_OPTIONS = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Medium" },
  { id: "high", label: "High" },
];
const AVOID_OPTIONS = [
  { id: "motorways", label: "Motorways" },
  { id: "tollRoads", label: "Toll roads" },
  { id: "unpavedRoads", label: "Unpaved roads" },
  { id: "ferries", label: "Ferries" },
];

export default function MapRouteTypeSelector({ visible, onClose }) {
  const {
    routeType,
    setRouteType,
    avoidOptions,
    setAvoidOption,
    customHilliness,
    setCustomHilliness,
    customWindingness,
    setCustomWindingness,
  } = useContext(RoutingPreferencesContext);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close route options" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Route options</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close route options">
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Route type</Text>
            <View style={styles.segmentRow}>
              {ROUTE_OPTIONS.map(option => {
                const selected = routeType === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.segment, selected && styles.segmentSelected]}
                    onPress={() => setRouteType(option.id)}
                  >
                    <Text numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Avoid</Text>
            <View style={styles.avoidGrid}>
              {AVOID_OPTIONS.map(option => (
                <View key={option.id} style={styles.avoidRow}>
                  <Text style={styles.avoidText}>{option.label}</Text>
                  <Switch
                    value={Boolean(avoidOptions[option.id])}
                    onValueChange={value => setAvoidOption(option.id, value)}
                    trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentMid }}
                  />
                </View>
              ))}
            </View>

            <View style={styles.divider} />
            <LevelSelector title="Twisty" value={customWindingness} onChange={setCustomWindingness} />
            <LevelSelector title="Undulating" value={customHilliness} onChange={setCustomHilliness} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function LevelSelector({ title, value, onChange }) {
  return (
    <View style={styles.levelSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.segmentRow}>
        {LEVEL_OPTIONS.map(option => {
          const selected = value === option.id;
          return (
            <TouchableOpacity
              key={`${title}-${option.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.levelSegment, selected && styles.segmentSelected]}
              onPress={() => onChange(option.id)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    maxHeight: "82%",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  header: {
    minHeight: 42,
    marginBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  doneText: {
    padding: 8,
    color: theme.colors.accentMid,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryDark,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 6,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  levelSegment: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 6,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentSelected: {
    backgroundColor: theme.colors.accentMid,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextSelected: {
    color: theme.colors.primaryDark,
    fontWeight: "700",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: theme.spacing.md,
    backgroundColor: theme.colors.border,
  },
  avoidGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: theme.spacing.md,
  },
  avoidRow: {
    width: "47%",
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avoidText: {
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  levelSection: {
    marginBottom: theme.spacing.md,
  },
});
import { useContext } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { RoutingPreferencesContext } from "@context/RoutingPreferencesContext";
import theme from "@themes";

const THEME_OPTIONS = [
  { id: "rider", label: "🏍️ Rider", description: "Motorcycle/scooter routes (Vespa, Lambretta)" },
];

export default function RouteThemeSelector() {
  const { theme: selectedTheme, setTheme } = useContext(RoutingPreferencesContext);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ride Theme</Text>
      <Text style={styles.description}>Select your primary mode of transport</Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.optionsScroll}
        contentContainerStyle={styles.optionsContainer}
      >
        {THEME_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.themeButton,
              selectedTheme === option.id && styles.themeButtonActive,
            ]}
            onPress={() => setTheme(option.id)}
          >
            <Text
              style={[
                styles.themeLabel,
                selectedTheme === option.id && styles.themeLabelActive,
              ]}
            >
              {option.label}
            </Text>
            <Text
              style={[
                styles.themeDescription,
                selectedTheme === option.id && styles.themeDescriptionActive,
              ]}
            >
              {option.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  optionsScroll: {
    marginHorizontal: -theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  optionsContainer: {
    paddingRight: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  themeButton: {
    minWidth: 140,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
  },
  themeButtonActive: {
    backgroundColor: theme.colors.accentLight || theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  themeLabelActive: {
    color: theme.colors.accent,
  },
  themeDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  themeDescriptionActive: {
    color: theme.colors.accentDark || theme.colors.accent,
  },
});

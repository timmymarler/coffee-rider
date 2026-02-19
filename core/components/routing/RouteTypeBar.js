import { RoutingPreferencesContext } from "@context/RoutingPreferencesContext";
import theme from "@themes";
import { useContext } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function RouteTypeBar() {
  const { routeType, setRouteType, availableRouteTypes } = useContext(RoutingPreferencesContext);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
      >
        {availableRouteTypes.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.option,
              routeType === option.id && styles.optionActive,
            ]}
            onPress={() => setRouteType(option.id)}
          >
            <Text
              style={[
                styles.optionLabel,
                routeType === option.id && styles.optionLabelActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    height: 50,
    paddingHorizontal: theme.spacing.lg,
  },
  scrollContent: {
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  option: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.inputBg,
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    justifyContent: "center",
  },
  optionActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
    whiteSpace: "nowrap",
  },
  optionLabelActive: {
    color: theme.colors.primaryDark,
  },
});

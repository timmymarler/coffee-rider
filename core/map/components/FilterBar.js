import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RIDER_FILTER_CATEGORIES } from "../config/riderFilterConfig";

export function FilterBar({ filters, setFilters }) {
  const toggle = (key) => {
    const newSet = new Set(filters.categories);

    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);

    setFilters({ ...filters, categories: newSet });
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {RIDER_FILTER_CATEGORIES.map((cat) => {
          const active = filters.categories.has(cat.key);
          return (
            <Pressable
              key={cat.key}
              onPress={() => toggle(cat.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={18}
                color={active ? "#fff" : "#333"}
              />
              <Text style={[styles.label, active && styles.labelActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingTop: 4,
    paddingBottom: 4,
  },
  row: {
    paddingHorizontal: 10,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    backgroundColor: "#ffffffdd",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  chipActive: {
    backgroundColor: "#333",
    borderColor: "#333",
  },
  label: {
    marginLeft: 5,
    color: "#333",
  },
  labelActive: {
    color: "#fff",
  },
});

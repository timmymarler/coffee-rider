import { Ionicons } from "@expo/vector-icons";
import theme from "@themes";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export function SearchBar({
  value,
  onChange,
  onSubmit = () => {},   // ✅ default no-op  results = [],
  isLoading = false,
  onClear,
  onFilterPress,
  filtersActive = false,
}) {
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* ---- Main Search Row ---- */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <TouchableOpacity
            onPress={() => {
              const trimmed = value?.trim();
              if (trimmed?.length > 0 && typeof onSubmit === "function") {
                onSubmit(trimmed);
              }
            }}
          >
            <Ionicons
              name="search"
              size={18}
              color={theme.colors.accentMid}
              style={{ marginRight: 8 }}
            />
          </TouchableOpacity>

          <TextInput
            value={value}
            onChangeText={onChange}
            onSubmitEditing={() => {
              const trimmed = value?.trim();
              if (trimmed?.length > 0 && typeof onSubmit === "function") {
                onSubmit(trimmed);
              }
            }}
            placeholder="Search places…"
            placeholderTextColor={theme.colors.primaryLight}
            style={[styles.searchInput, { color: theme.colors.accentMid }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />

          {isLoading && (
            <ActivityIndicator
              size="small"
              color={theme.colors.accentMid}
              style={{ marginLeft: 4 }}
            />
          )}

          {value?.length > 0 && !isLoading && (
            <TouchableOpacity onPress={onClear}>
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.accentMid}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={onFilterPress}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options"
            size={20}
            color={filtersActive ? theme.colors.accentMid : theme.colors.primaryLight}
          />
        </TouchableOpacity>

      </View>

    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      top: 10,
      left: 12,
      right: 30, // leaves room for filter button
      zIndex: 10,
      elevation: 10,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.primaryDark,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      shadowColor: theme.colors.accentMid,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      paddingVertical: 0,
      marginRight: 6,
    },
    filterButton: {
      marginLeft: 8,
      width: 41,
      height: 41,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryDark,
      shadowColor: theme.colors.accentMid,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },

    iconButton: {
      marginLeft: 8,
      width: 41,
      height: 41,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryDark,
      shadowColor: theme.colors.accentMid,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },

  });
}

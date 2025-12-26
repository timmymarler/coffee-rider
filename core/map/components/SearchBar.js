import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@themes";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export function SearchBar({
  value,
  onChange,
  results = [],
  isLoading = false,
  onResultPress,
  onClear,
  onFilterPress,
}) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* ---- Main Search Row ---- */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons
            name="search"
            size={18}
            color={theme.colors.textMuted}
            style={{ marginRight: 8 }}
          />

          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Search places…"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.text }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />

          {isLoading && (
            <ActivityIndicator
              size="small"
              color={theme.colors.textMuted}
              style={{ marginLeft: 4 }}
            />
          )}

          {value?.length > 0 && !isLoading && (
            <TouchableOpacity onPress={onClear}>
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.textMuted}
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
            color={theme.colors.primaryDark}
          />
        </TouchableOpacity>
      </View>

      {/* ---- Results ---- */}
      {results.length > 0 && (
        <View style={styles.resultsPanel}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onResultPress(item)}
                style={styles.resultItem}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={theme.colors.textMuted}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.resultPrimary}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>

                  {item.address && (
                    <Text
                      style={styles.resultSecondary}
                      numberOfLines={1}
                    >
                      {item.address}
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      top: 60,
      left: 12,
      right: 60, // leaves room for filter button
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
      backgroundColor: theme.colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      shadowColor: theme.colors.shadow,
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
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    resultsPanel: {
      marginTop: 6,
      borderRadius: 14,
      backgroundColor: theme.colors.card,
      maxHeight: 260,
      paddingVertical: 4,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    resultPrimary: {
      fontSize: 14,
      color: theme.colors.text,
    },
    resultSecondary: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });
}

// core/map/components/SearchBar.js
import { Ionicons } from "@expo/vector-icons";
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
  query,
  onChangeText,
  isLoading,
  suggestions,
  onSuggestionPress,
  onClear,
  theme,
}) {
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
            value={query}
            onChangeText={onChangeText}
            placeholder="Search cafés and places…"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />

          {isLoading && (
            <ActivityIndicator
              size="small"
              color={theme.colors.textMuted}
              style={{ marginLeft: 4 }}
            />
          )}

          {query.length > 0 && !isLoading && (
            <TouchableOpacity onPress={onClear}>
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button (not wired yet, safe placeholder) */}
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options" size={20} color={theme.colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* ---- Suggestions ---- */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsPanel}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSuggestionPress(item)}
                style={styles.suggestionItem}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={theme.colors.textMuted}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.suggestionPrimary}
                    numberOfLines={1}
                  >
                    {item.structured_formatting?.main_text ||
                      item.description}
                  </Text>

                  {item.structured_formatting?.secondary_text && (
                    <Text
                      style={styles.suggestionSecondary}
                      numberOfLines={1}
                    >
                      {item.structured_formatting.secondary_text}
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
      top: 40,
      left: 12,
      right: 12,
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
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
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
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    suggestionsPanel: {
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
    suggestionItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    suggestionPrimary: {
      fontSize: 14,
      color: theme.colors.text,
    },
    suggestionSecondary: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });
}

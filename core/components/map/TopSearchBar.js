import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TextInput, View } from "react-native";

export default function TopSearchBar({ search, onChangeSearch, onFocus }) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color="#666" style={{ marginLeft: 10 }} />

      <TextInput
        value={search}
        onChangeText={onChangeSearch}
        placeholder="Search places…"
        placeholderTextColor="#999"
        style={styles.input}
        onFocus={onFocus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 15,
    left: 15,
    right: 65, // space for filter button on the right
    height: 48,
    backgroundColor: "#fff",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 6,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
    color: "#333",
  },
});

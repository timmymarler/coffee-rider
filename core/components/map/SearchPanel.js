import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

export default function SearchPanel({ suggestions, onSelect }) {
  return (
    <View style={styles.panel}>
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.place_id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => onSelect(item.place_id, item.description)}
          >
            <Text style={styles.text}>{item.description}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 70,
    borderRadius: 12,
    maxHeight: 260,
    elevation: 6,
  },
  row: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  text: {
    fontSize: 15,
    color: "#333",
  },
});

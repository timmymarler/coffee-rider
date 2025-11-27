import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

export default function FilterButton({ onPress }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Ionicons name="filter" size={22} color="#333" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 15,
    right: 15,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },
});

import { View, Text, StyleSheet } from "react-native";

export default function AppHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>☕ Café Rider</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: "#007aff",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#005ec2",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1,
  },
});

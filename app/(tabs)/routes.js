import { Text, View } from "react-native";
import { Header } from "../../components/layout/Header";

export default function RoutesScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Header mode="icon-title" title="Routes" />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "white" }}>Routes coming soon…</Text>
      </View>
    </View>
  );
}

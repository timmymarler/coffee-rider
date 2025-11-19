import { Text, View } from "react-native";
import { Header } from "../../components/layout/Header";

export default function FavouritesScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Header mode="icon-title" title="Favourites" />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "white" }}>Favourites coming soon…</Text>
      </View>
    </View>
  );
}

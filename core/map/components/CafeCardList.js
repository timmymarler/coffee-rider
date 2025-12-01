// core/map/components/CafeCardList.js
import { FlatList, StyleSheet, View } from "react-native";
import { CafeCard } from "./CafeCard";

export function CafeCardList({ cafes, onSelectCafe, onNavigate }) {
  if (!cafes || cafes.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={cafes}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <CafeCard
              cafe={item}
              onPress={() => onSelectCafe(item)}
              onNavigatePress={() => onNavigate(item)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
  },
  cardWrapper: {
    width: 280,
  },
});

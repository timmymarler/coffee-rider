// core/map/components/PoiDebugger.js
import { Text, View } from "react-native";

export default function PoiDebugger({ place }) {
  if (!place) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 40,
        left: 10,
        right: 10,
        padding: 12,
        backgroundColor: "rgba(0,0,0,0.8)",
        borderRadius: 8,
        zIndex: 9999,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "bold", marginBottom: 6 }}>
        DEBUG INFO
      </Text>

      <Text style={{ color: "#fff", fontSize: 12 }}>
        <Text style={{ fontWeight: "bold" }}>Name: </Text>
        {place.title}
      </Text>

      <Text style={{ color: "#fff", fontSize: 12 }}>
        <Text style={{ fontWeight: "bold" }}>Types: </Text>
        {JSON.stringify(place.types)}
      </Text>

      <Text style={{ color: "#fff", fontSize: 12 }}>
        <Text style={{ fontWeight: "bold" }}>Keywords: </Text>
        {place._keywordsMatched?.length
          ? place._keywordsMatched.join(", ")
          : "None"}
      </Text>
    </View>
  );
}

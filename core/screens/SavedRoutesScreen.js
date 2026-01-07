import { useSavedRoutes } from "@/core/map/routes/useSavedRoutes";
import { TabBarContext } from "@context/TabBarContext";
import { WaypointsContext } from "@core/map/waypoints/WaypointsContext";
import theme from "@themes";
import { useRouter } from "expo-router";
import { useContext } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";


export default function SavedRoutesScreen() {
  const { routes, loading } = useSavedRoutes();
  const router = useRouter();
  const { reloadMap } = useContext(TabBarContext);
  const { setPendingSavedRouteId } = useContext(WaypointsContext);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Loading routes…</Text>
      </View>
    );
  }

  if (!routes.length) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text>No saved routes yet</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={routes}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              setPendingSavedRouteId(item.id);
              router.push("/map");

              setTimeout(() => {
                reloadMap();
              }, 0);
            }}
          >
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Text style={{ fontWeight: "600" }}>
                {item.destination?.title || "Unnamed route"}
              </Text>

              <Text style={{ color: theme.colors.textMuted }}>
                {Math.round((item.distanceMeters / 1000)*0.62)} miles •{" "}
                {Math.round(item.durationSeconds.substring(0,item.durationSeconds.length -1) / 60)} mins
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

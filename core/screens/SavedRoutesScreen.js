// core/screens/SavedRoutesScreen.js

import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { getTheme } from "@themes";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function SavedRoutesScreen() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const theme = getTheme();

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch routes for the logged-in user
  async function fetchRoutes() {
    try {
      if (!user) return;

      const q = query(
        //collection(db, "routes"),
        collection(db, "routes", user.uid, "saved"),
        where("userId", "==", user.uid)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      setRoutes(results);
    } catch (err) {
      console.error("Error loading routes:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) fetchRoutes();
  }, [user]);

  // -----------------------------
  // Logged-out screen state
  // -----------------------------
  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textMuted, marginBottom: 20 }}>
          You must be logged in to view saved routes.
        </Text>

        <TouchableOpacity
          onPress={() => router.push("auth/login")}
          style={{
            backgroundColor: theme.colors.primary,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "600" }}>
            Log In
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -----------------------------
  // Loading state
  // -----------------------------
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textMuted }}>Loading routes…</Text>
      </View>
    );
  }

  // -----------------------------
  // No routes saved
  // -----------------------------
  if (routes.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textMuted }}>
          You haven’t saved any routes yet.
        </Text>
      </View>
    );
  }

  // -----------------------------
  // Render saved routes
  // -----------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.routeCard,
              { backgroundColor: theme.colors.surface },
            ]}
            onPress={() => router.push(`/route-preview?id=${item.id}`)}
          >
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {item.name || "Unnamed Route"}
            </Text>

            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              {item.waypoints?.length || 0} stops
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  routeCard: {
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
  },
});

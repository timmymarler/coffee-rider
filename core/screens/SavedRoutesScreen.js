import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { theme } from "@/config/theme";
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { getPlaceLabel } from "@core/lib/geocode";
import { openGoogleMapsRoute } from "@lib/maps";

export default function SavedRoutesScreen() {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();

  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [locationLabels, setLocationLabels] = useState({}); // key = "start:routeId" / "end:routeId"

  // Load favourite routes from Firestore
  useEffect(() => {
    if (!user) {
      setRoutes([]);
      setLoadingRoutes(false);
      return;
    }

    setLoadingRoutes(true);

    const routesRef = collection(db, "users", user.uid, "favouriteRoutes");
    const q = query(routesRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setRoutes(data);
        setLoadingRoutes(false);
      },
      (error) => {
        console.error("Failed to load favourite routes:", error);
        setLoadingRoutes(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Resolve nice labels for start/end using geocode utils
  useEffect(() => {
    let cancelled = false;

    async function loadLabelsForRoutes() {
      if (!routes.length) return;

      for (const route of routes) {
        const pairs = [
          { key: `start:${route.id}`, point: route.start },
          { key: `end:${route.id}`, point: route.end },
        ];

        for (const { key, point } of pairs) {
          if (!point?.latitude || !point?.longitude) continue;
          if (locationLabels[key]) continue; // already have it

          try {
            const label = await getPlaceLabel(
              point.latitude,
              point.longitude
            );
            if (cancelled) return;
            if (label) {
              setLocationLabels((prev) => ({
                ...prev,
                [key]: label,
              }));
            }
          } catch (err) {
            console.error("Error resolving label for route:", err);
          }
        }
      }
    }

    loadLabelsForRoutes();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  // Still resolving auth
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Saved routes</Text>
        <Text style={styles.subtitle}>
          Sign in to save and manage your favourite routes.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Logged in but no routes
  if (!loadingRoutes && routes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No saved routes yet</Text>
        <Text style={styles.subtitle}>
          Plan a ride on the map and save it to see it here.
        </Text>
      </View>
    );
  }

  function renderRoute({ item }) {
    const { id, name, start, end, snappedCoords, waypoints, createdAt } = item;

    const startKey = `start:${id}`;
    const endKey = `end:${id}`;

    const startLabel = locationLabels[startKey];
    const endLabel = locationLabels[endKey];

    const createdDate =
      createdAt?.toDate?.().toLocaleDateString?.() ?? "Unknown date";

    const waypointCount = Array.isArray(waypoints) ? waypoints.length : 0;
    const waypointStr =
      waypointCount === 0
        ? "No waypoints"
        : waypointCount === 1
        ? "1 waypoint"
        : `${waypointCount} waypoints`;

    // Prefer a real distanceMeters field from Firestore if you add it later
    const distanceMeters = typeof item.distanceMeters === "number"
      ? item.distanceMeters
      : null;

    let distanceStr = null;
    if (distanceMeters != null) {
      const miles = distanceMeters / 1609.34;
      distanceStr = `${miles.toFixed(1)} miles`;
    }

    // DO NOT fall back to grid references; just use generic labels
    const startText = startLabel || "Start";
    const endText = endLabel || "End";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.routeName}>
            {name || "Unnamed route"}
          </Text>
          <Text style={styles.date}>{createdDate}</Text>
        </View>

        <View style={styles.routeRow}>
          <Ionicons
            name="navigate-outline"
            size={18}
            color={theme.colors.accent}
          />
          <Text style={styles.routeText}>
            {startText} ➜ {endText}
          </Text>
        </View>

        <View style={styles.metaRow}>
          {distanceStr ? (
            <Text style={styles.metaText}>{distanceStr}</Text>
          ) : (
            <Text style={styles.metaText}>Distance unknown</Text>
          )}
          <Text style={styles.metaText}>{waypointStr}</Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => openGoogleMapsRoute(item)}
          >
            <Text style={styles.primaryButtonText}>Navigate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openGoogleMapsRoute(item)}
          >
            <Text style={styles.secondaryButtonText}>View on map</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Your favourite routes</Text>

      {loadingRoutes ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading routes…</Text>
        </View>
      ) : null}

      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={renderRoute}
        contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 50,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  screenTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  title: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 12,
  },
  button: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  routeName: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  date: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 6,
    gap: 6,
  },
  routeText: {
    color: theme.colors.text,
    fontSize: 14,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
});

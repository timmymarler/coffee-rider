import { AuthContext } from "@context/AuthContext";
import { TabBarContext } from "@context/TabBarContext";
import { useWaypointsContext } from "@core/map/waypoints/WaypointsContext";
import { createActiveRide } from "@core/map/routes/activeRideService";
import { acceptRideInvite, declineRideInvite, markRideInviteAccepted, usePendingRideInvites } from "@core/map/routes/rideInvites";
import theme from "@themes";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@config/firebase";
import { useContext, useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";

function formatInviteTime(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  return date ? date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time to be agreed";
}

function getRoutePreviewPath(points = [], width = 280, height = 72) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const longitudes = points.map(point => point.longitude);
  const latitudes = points.map(point => point.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = maxLongitude - minLongitude || 1;
  const latitudeRange = maxLatitude - minLatitude || 1;
  return points.map((point, index) => {
    const x = 10 + ((point.longitude - minLongitude) / longitudeRange) * (width - 20);
    const y = 8 + ((maxLatitude - point.latitude) / latitudeRange) * (height - 16);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function RideInvitePrompt() {
  const { user } = useContext(AuthContext) || {};
  const { activeRide, mapActions } = useContext(TabBarContext);
  const { setPendingSavedRouteId, setEnableFollowMeAfterLoad, setPreserveLoadedRouteForNextRide } = useWaypointsContext();
  const router = useRouter();
  const invites = usePendingRideInvites(user?.uid);
  const [hasActiveRideDocument, setHasActiveRideDocument] = useState(false);
  const [workingInviteId, setWorkingInviteId] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setHasActiveRideDocument(false);
      return undefined;
    }
    return onSnapshot(doc(db, "activeRides", user.uid), snapshot => {
      setHasActiveRideDocument(snapshot.exists() && Boolean(snapshot.data()?.rideId));
    }, error => {
      console.warn("[RideInvites] Active ride listener error:", error?.message || error);
      setHasActiveRideDocument(false);
    });
  }, [user?.uid]);
  const invite = invites.find(item => item.id !== workingInviteId) || null;
  const isNavigating = Boolean(activeRide) || hasActiveRideDocument || Boolean(mapActions?.isFollowing?.());
  const visible = Boolean(invite) && !isNavigating;
  const routePreviewPath = getRoutePreviewPath(invite?.routePreview);

  async function respond(accept) {
    if (!invite || !user?.uid || workingInviteId) return;
    setWorkingInviteId(invite.id);
    try {
      if (accept) {
        await acceptRideInvite(invite, user);
        setPreserveLoadedRouteForNextRide(true);
        await createActiveRide({ user, rideId: invite.routeId, groupId: invite.groupId, routeName: invite.routeName });
        await markRideInviteAccepted(invite);
        setPendingSavedRouteId(invite.routeId);
        setEnableFollowMeAfterLoad(true);
        router.push("/map");
      } else {
        await declineRideInvite(invite);
      }
    } catch (error) {
      if (accept) setPreserveLoadedRouteForNextRide(false);
      Alert.alert(accept ? "Couldn't join ride" : "Couldn't dismiss invitation", error?.message || "Please try again.");
    } finally {
      setWorkingInviteId(null);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.62)" }}>
        <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.tabBarInactive, borderWidth: 1.5, borderRadius: 12, padding: 20 }}>
          <Text style={{ color: theme.colors.text, fontSize: 19, fontWeight: "700" }}>Join Ride invitation</Text>
          <Text style={{ color: theme.colors.text, fontSize: 16, marginTop: 16 }}>
            {invite?.senderName || "A rider"} has invited you to join a ride
          </Text>
          <View style={{ marginTop: 14, padding: 12, borderRadius: 8, backgroundColor: theme.colors.primaryDark }}>
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{invite?.routeName || "Shared ride"}</Text>
            {routePreviewPath ? (
              <View style={{ marginTop: 10, borderRadius: 6, overflow: "hidden", backgroundColor: theme.colors.surface }}>
                <Svg width="100%" height={72} viewBox="0 0 280 72">
                  <Path d={routePreviewPath} stroke={theme.colors.tabBarInactive} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </Svg>
              </View>
            ) : null}
            <Text style={{ color: theme.colors.textMuted, marginTop: 5 }}>{formatInviteTime(invite?.startTime)}</Text>
            {Number.isFinite(invite?.distanceMeters) ? (
              <Text style={{ color: theme.colors.textMuted, marginTop: 3 }}>{(invite.distanceMeters / 1000).toFixed(1)} km planned</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Pressable
              onPress={() => respond(false)}
              disabled={Boolean(workingInviteId)}
              style={{ paddingVertical: 11, paddingHorizontal: 18, borderRadius: 7, borderWidth: 1, borderColor: theme.colors.inputBorder }}
            >
              <Text style={{ color: theme.colors.text }}>Decline</Text>
            </Pressable>
            <Pressable
              onPress={() => respond(true)}
              disabled={Boolean(workingInviteId)}
              style={{ paddingVertical: 11, paddingHorizontal: 18, borderRadius: 7, backgroundColor: theme.colors.accentMid, opacity: workingInviteId ? 0.7 : 1 }}
            >
              <Text style={{ color: theme.colors.primaryDark, fontWeight: "700" }}>{workingInviteId ? "Joining…" : "Accept"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

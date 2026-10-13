import * as Location from "expo-location";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";

export async function createActiveRide({ user, rideId, groupId, routeName }) {
  if (!user?.uid || !rideId || !groupId) throw new Error("User, route and group are required to start a shared ride");
  const profileSnapshot = await getDoc(doc(db, "users", user.uid));
  const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const userName = profileData.displayName?.trim() || user.displayName || user.email || "Rider";
  const userAvatar = profileData.photoURL || profileData.avatarUrl || user.photoURL || null;
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  if (!location?.coords || !Number.isFinite(location.coords.latitude) || !Number.isFinite(location.coords.longitude)) {
    throw new Error("Unable to get a valid GPS fix. Please wait for signal and try again.");
  }

  const payload = {
    userId: user.uid,
    rideId,
    groupId,
    routeName: routeName || null,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    startedAt: serverTimestamp(),
    lastLocationUpdate: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    userName,
  };
  if (userAvatar) payload.userAvatar = userAvatar;
  await setDoc(doc(db, "activeRides", user.uid), payload, { merge: true });
  return payload;
}

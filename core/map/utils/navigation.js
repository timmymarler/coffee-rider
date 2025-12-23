import { Linking, Platform } from "react-native";

export async function openNativeNavigation({ destination, waypoints = [] }) {
  if (!destination?.latitude || !destination?.longitude) return;

  const lat = destination.latitude;
  const lng = destination.longitude;

  try {
    if (Platform.OS === "ios") {
      // Apple Maps (always available on iOS)
      const appleUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      await Linking.openURL(appleUrl);
      return;
    }

    // ANDROID FLOW
    // First try Google Maps app
    const googleAppUrl = `google.navigation:q=${lat},${lng}&mode=d`;
    const canOpenGoogleApp = await Linking.canOpenURL(googleAppUrl);

    if (canOpenGoogleApp) {
      await Linking.openURL(googleAppUrl);
      return;
    }

    // Fallback: Google Maps web
    const googleWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    await Linking.openURL(googleWebUrl);
  } catch (err) {
    console.warn("[NAVIGATION] Failed to open navigation:", err);
  }
}

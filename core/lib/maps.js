import { Linking, Platform } from "react-native";

export const openGoogleMapsRoute = (route) => {
  const { start, end, waypoints = [] } = route;

  const startStr = `${start.latitude},${start.longitude}`;
  const endStr = `${end.latitude},${end.longitude}`;
  const waypointStr = waypoints
    .map(wp => `${wp.latitude},${wp.longitude}`)
    .join("|");

  const gmapsURL =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${startStr}` +
    `&destination=${endStr}` +
    (waypointStr ? `&waypoints=${waypointStr}` : "") +
    `&travelmode=driving`;

  Linking.openURL(gmapsURL).catch(() => {
    if (Platform.OS === "ios") {
      const chain = waypoints.length
        ? waypoints.map(wp => `${wp.latitude},${wp.longitude}`).join("+to:")
        : endStr;

      const appleURL = `http://maps.apple.com/?saddr=${startStr}&daddr=${chain}`;
      Linking.openURL(appleURL).catch(err =>
        console.log("Apple Maps fallback failed:", err)
      );
    }
  });
};

export const getStaticRouteMapUrl = (route) => {
  const { start, end, waypoints = [], snappedCoords = [] } = route;

  const pathCoords = snappedCoords
    .map(p => `${p.latitude},${p.longitude}`)
    .join("|");

  const markers = [
    `color:0xD4A056|${start.latitude},${start.longitude}`,   // Start
    ...waypoints.map(wp => `color:0x7FC8F8|${wp.latitude},${wp.longitude}`),
    `color:0x004E89|${end.latitude},${end.longitude}`        // End
  ];

  const markerParams = markers
    .map(m => `&markers=${encodeURIComponent(m)}`)
    .join("");

  const url =
    `https://maps.googleapis.com/maps/api/staticmap?size=600x600` +
    `&path=${encodeURIComponent("color:0x004E89|weight:4|" + pathCoords)}` +
    markerParams +
    `&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

  return url;
};

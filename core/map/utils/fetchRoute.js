export async function fetchRoute({ origin, destination, mode }) {
  try {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    const url = `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&mode=${mode}` +
      `&key=${key}`;

    const response = await fetch(url);
    const json = await response.json();

    if (json.status !== "OK") {
      console.log("Route error:", json.status, json.error_message);
      return null;
    }

    const points = json.routes[0]?.overview_polyline?.points;
    return points || null;

  } catch (err) {
    console.log("Route fetch failed:", err);
    return null;
  }
}

export async function fetchRoute({ origin, destination, waypoints = [] }) {
  try {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    const intermediates =
      Array.isArray(waypoints) && waypoints.length > 0
        ? waypoints.map(wp => ({
            location: {
              latLng: {
                latitude: wp.latitude ?? wp.lat,
                longitude: wp.longitude ?? wp.lng,
              },
            },
          }))
        : undefined;

    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin.latitude,
                longitude: origin.longitude,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            },
          },

          // 🔑 ADD THIS
          intermediates,
          travelMode: "DRIVE",
          routeModifiers: {
            avoidHighways: true,   // 🚫 motorways
          },          
        }),
      }
    );

    const json = await response.json();

    const route = json.routes?.[0];
    if (!route?.polyline?.encodedPolyline) {
      console.log("Route error:", json);
      return null;
    }

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.duration,
    };
  } catch (err) {
    console.log("Route fetch failed:", err);
    return null;
  }
}

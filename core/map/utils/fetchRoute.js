export async function fetchRoute({ origin, destination, waypoints = [] }) {
  try {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;

    if (!key) {
      console.error("Google Maps API key not found");
      return null;
    }

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
          // Include steps and maneuver details in the same request
          "X-Goog-FieldMask": [
            // Overall route
            "routes.polyline.encodedPolyline",
            "routes.distanceMeters",
            "routes.duration",
            // Legs and steps
            "routes.legs.steps.distanceMeters",
            "routes.legs.steps.startLocation",
            "routes.legs.steps.endLocation",
            "routes.legs.steps.navigationInstruction",
          ].join(","),
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

    // Extract first leg's steps (if present)
    const leg = route.legs?.[0];
    const steps = Array.isArray(leg?.steps)
      ? leg.steps.map((s) => ({
          start: {
            latitude: s.startLocation?.latLng?.latitude,
            longitude: s.startLocation?.latLng?.longitude,
          },
          end: {
            latitude: s.endLocation?.latLng?.latitude,
            longitude: s.endLocation?.latLng?.longitude,
          },
          distanceMeters: s.distanceMeters ?? null,
          maneuver: s.navigationInstruction?.maneuver ?? null,
          instruction: s.navigationInstruction?.instructions ?? null,
        }))
      : [];

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.duration,
      steps,
    };
  } catch (err) {
    console.log("Route fetch failed:", err);
    return null;
  }
}

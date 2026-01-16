const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export async function getGoogleDetails({ placeId, name, latitude, longitude }) {
  try {
    if (placeId) {
      console.log("[getGoogleDetails] Using placeId:", placeId, "KEY available:", !!KEY);
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,photos,rating,user_ratings_total,price_level,business_status,opening_hours&key=${KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      console.log("[getGoogleDetails] API Response status:", json.status);
      if (json.status === "OK") {
        console.log("[getGoogleDetails] Success - returning result");
        return json.result;
      } else {
        console.log("[getGoogleDetails] API error status:", json.status, "Message:", json.error_message);
      }
    }

    if (name && latitude && longitude) {
      console.log("[getGoogleDetails] Using text search:", name);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        name
      )}&location=${latitude},${longitude}&radius=200&key=${KEY}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.status === "OK" && json.results.length > 0) {
        return json.results[0];
      }
    }
  } catch (err) {
    console.log("[getGoogleDetails] Catch error:", err);
  }

  console.log("[getGoogleDetails] Returning null");
  return null;
}

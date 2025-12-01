const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export async function getGoogleDetails({ placeId, name, latitude, longitude }) {
  try {
    if (placeId) {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,photos,rating,user_ratings_total,price_level&key=${KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status === "OK") return json.result;
    }

    if (name && latitude && longitude) {
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
    console.log("getGoogleDetails error:", err);
  }

  return null;
}

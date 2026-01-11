const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export async function fetchGooglePhotoRefs(placeId, limit = 1) {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=photos`,
      {
        headers: {
          "X-Goog-Api-Key": GOOGLE_KEY,
        },
      }
    );

    const json = await res.json();

    if (!Array.isArray(json?.photos)) return [];

    return json.photos
      .map(p => p.name)
      .filter(Boolean)
      .slice(0, limit);

  } catch (e) {
    console.log("PHOTO DETAILS FAIL", e);
    return [];
  }
}

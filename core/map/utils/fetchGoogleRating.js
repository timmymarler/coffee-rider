const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export async function fetchGoogleRating(placeId) {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=rating,userRatingCount`,
      {
        headers: {
          "X-Goog-Api-Key": GOOGLE_KEY,
        },
      }
    );

    const json = await res.json();

    if (!json || typeof json.rating !== "number") {
      return { rating: null, userRatingCount: null };
    }

    return {
      rating: json.rating,
      userRatingCount:
        typeof json.userRatingCount === "number"
          ? json.userRatingCount
          : null,
    };
  } catch (e) {
    console.log("GOOGLE RATING FETCH FAIL", e);
    return { rating: null, userRatingCount: null };
  }
}

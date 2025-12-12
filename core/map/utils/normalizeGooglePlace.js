export function normalizeGooglePlace(place) {
  const title = place.displayName?.text || "";
  const types = place.types || [];

  // Rider-focused keyword matching
  const keywords = ["cafe", "coffee", "biker", "motorcycle", "scenic", "tea", "fuel"];
  const matchedKeywords = keywords.filter(kw =>
    title.toLowerCase().includes(kw)
  );

  return {
    id: place.id,
    title,
    types,
    matchedKeywords,

    address: place.formattedAddress,
    latitude: place.location.latitude,
    longitude: place.location.longitude,

    rating: place.rating,
    userRatingsTotal: place.userRatingCount,

    source: "google",

    googlePhotoUrls:
      place.photos?.map(
        p =>
          `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
      ) || [],

    type: types[0] || "point_of_interest",
  };
}

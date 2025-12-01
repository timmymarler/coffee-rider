// core/map/utils/mergePlaceData.js
export function buildGooglePhotoUrl(ref, apiKey) {
  if (!ref || !apiKey) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${apiKey}`;
}

export function extractGooglePhotoUrls(googleResult, apiKey) {
  if (!googleResult?.photos) return [];
  return googleResult.photos
    .slice(0, 6)
    .map((p) => buildGooglePhotoUrl(p.photo_reference, apiKey))
    .filter(Boolean);
}

export function mergeCafeAndGoogle(cafe, google, googlePhotoUrls) {
  if (!cafe && !google) return null;

  const lat =
    cafe?.coords?.latitude ??
    cafe?.latitude ??
    google?.geometry?.location?.lat ??
    null;

  const lng =
    cafe?.coords?.longitude ??
    cafe?.longitude ??
    google?.geometry?.location?.lng ??
    null;

  // CR photos first
  const cafePhotos = Array.isArray(cafe?.photos) ? cafe.photos : [];
  const primaryCafePhoto = cafePhotos[0] || cafe?.photoURL || null;
  const photos =
    cafePhotos.length > 0
      ? cafePhotos
      : primaryCafePhoto
      ? [primaryCafePhoto]
      : [];

  // Rating logic
  let rating = null;
  if (
    typeof cafe?.serviceRating === "number" &&
    typeof cafe?.valueRating === "number"
  ) {
    rating = (cafe.serviceRating + cafe.valueRating) / 2;
  } else if (google?.rating) {
    rating = google.rating;
  }

  const amenities = cafe
    ? {
        bikes: !!cafe.bikes,
        cars: !!cafe.cars,
        scooters: !!cafe.scooters,
        cyclists: !!cafe.cyclists,
        pets: !!cafe.pets,
        disability: !!cafe.disability,
        offRoadParking: !!cafe.offRoadParking,
      }
    : null;
// ----- Coffee Rider Ratings -----
const crRatings = cafe?.crRatings
  ? {
      average: cafe.crRatings.average || null,
      count: cafe.crRatings.count || 0,
      users: cafe.crRatings.users || {},
      comments: cafe.crRatings.comments || [],
    }
  : null;

// ----- Hours (CR first, fallback to Google) -----
const hours = cafe?.hours
  ? cafe.hours
  : google?.opening_hours
  ? {
      open_now: google.opening_hours.open_now,
      weekday_text: google.opening_hours.weekday_text || [],
    }
  : null;

  return {
    latitude: lat,
    longitude: lng,

    title: cafe?.name || google?.name || "Place",

    // Google address first
    address:
      google?.formatted_address ||
      cafe?.location ||
      cafe?.googleAddress ||
      "",

    rating,
    userRatingsTotal: google?.user_ratings_total ?? null,
    priceLevel: google?.price_level ?? null,
    priceRange: cafe?.priceRange ?? null,

    photos,
    googlePhotoUrls: googlePhotoUrls || [],

    cafeId: cafe?.id || null,
    placeId: google?.place_id || cafe?.placeId || null,

    amenities,
    source: cafe && google ? "merged" : cafe ? "cafe" : "google",

    crRatings,
    hours,

  };

}

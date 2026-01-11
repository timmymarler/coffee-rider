// core/map/utils/mergePlaceData.js
import { classifyPoi } from "../classify/classifyPois";

export function extractGooglePhotoRefs(googleResult) {
  if (!googleResult?.photos) return [];
  return googleResult.photos
    .slice(0, 6)
    .map(p => p.photo_reference)
    .filter(Boolean);
}

export function mergeCafeAndGoogle(cafe, google, googlePhotoUrls) {
  console.log("GOOGLE RAW PHOTOS", google?.photos);

  if (!cafe && !google) return null;

  const category = google ? classifyPoi(google) : cafe?.category ?? "other";

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

  return {
    latitude: lat,
    longitude: lng,

    title: cafe?.name || google?.name || "Place",
    category, // ← THIS IS THE KEY LINE
    
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

    photos: {
      cr: Array.isArray(cafe?.photos) ? cafe.photos : [],
      google: Array.isArray(google?.photos)
        ? google.photos.map(p => p.photo_reference).filter(Boolean)
        : []
    },

    cafeId: cafe?.id || null,
    placeId: google?.place_id || cafe?.placeId || null,

    amenities,
    source: cafe && google ? "merged" : cafe ? "cafe" : "google",
  };

}

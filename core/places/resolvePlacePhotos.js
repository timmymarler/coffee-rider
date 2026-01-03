import { ENABLE_GOOGLE_PHOTOS, PHOTO_POLICY } from "@core/config/photoPolicy";
import { buildGooglePhotoUrl } from "@core/google/buildGooglePhotoUrl";
import { getCachedGooglePhoto, setCachedGooglePhoto } from "@core/google/googlePhotoCache";
import { canFetchGooglePhoto, recordGooglePhotoFetch } from "@core/google/googlePhotoGuard";

export async function resolvePlacePhotos({ place, role }) {
  const policy = PHOTO_POLICY[role];

  // 1️⃣ CR photos always win
  if (policy.viewCrPhotos && place.crPhotos?.length > 0) {
    return {
      source: "cr",
      photos: place.crPhotos,
    };
  }

  // 2️⃣ Google photos (Pro/Admin only)
  if (
    ENABLE_GOOGLE_PHOTOS &&
    policy.viewGooglePhotos &&
    place.googlePhotoRef
  ) {
    const cached = getCachedGooglePhoto(place.id);
    if (cached) {
      return { source: "google", photos: [cached] };
    }

    if (!canFetchGooglePhoto()) {
      console.warn("[GOOGLE PHOTO] session limit reached");
      return { source: "none", photos: [] };
    }

    const uri = buildGooglePhotoUrl(place.googlePhotoRef);
    if (!uri) return { source: "none", photos: [] };

    recordGooglePhotoFetch();
    setCachedGooglePhoto(place.id, uri);

    console.log("[GOOGLE PHOTO FETCH]", place.id);

    return {
      source: "google",
      photos: refs.slice(0, GOOGLE_PHOTO_LIMITS.maxPhotosPerPlace).map(buildGooglePhotoUrl)
    };
  }

  // 3️⃣ Fallback
  return { source: "none", photos: [] };
}

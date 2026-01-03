
export function buildGooglePhotoUrl(photoName) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!photoName || !apiKey) return null;

  const photoRef = photoName.split("/photos/")[1];
  if (!photoRef) return null;

  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`;
}


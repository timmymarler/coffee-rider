export function buildGooglePhotoUrl(ref, width = 800) {
  if (!ref) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}&photo_reference=${ref}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`;
}

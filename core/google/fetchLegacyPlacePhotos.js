export async function fetchLegacyPlacePhotos(placeId, apiKey) {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${placeId}` +
    `&fields=photos` +
    `&key=${apiKey}`;

  const res = await fetch(url);
  const json = await res.json();

  if (!json?.result?.photos) return [];

  return json.result.photos
    .map((p) => p.photo_reference)
    .filter(Boolean)
    .slice(0, 5); // hard limit = cost control
}

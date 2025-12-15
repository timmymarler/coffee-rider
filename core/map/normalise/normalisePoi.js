// This will become the ONLY place where POIs are unified.
// Every source (Google Text, Google Details, Firestore CR) passes through here.

export function normalisePoi(raw) {
  if (!raw) return null;

  // ------------------------------
  // Extract shared fields safely
  // ------------------------------
  const id = raw.id;
  const source = raw.source || "google";

  const title = raw.title || raw.name || raw.displayName?.text || "";

  const address = raw.address || raw.formattedAddress || "";

  const latitude =
    raw.latitude ??
    raw.location?.latitude ??
    raw.geometry?.location?.lat ??
    null;

  const longitude =
    raw.longitude ??
    raw.location?.longitude ??
    raw.geometry?.location?.lng ??
    null;

  const types = raw.types || [];

  const rating = raw.rating ?? null;
  const userRatingsTotal = raw.userRatingsTotal ?? raw.userRatingCount ?? null;

  // ------------------------------
  // Photo URLs (Google or CR)
  // ------------------------------
  const googlePhotoUrls =
    raw.googlePhotoUrls ||
    raw.photos?.map(
      (p) =>
        `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
    ) ||
    [];

  // ------------------------------
  // Fields CR places may have
  // ------------------------------
  const suitability = raw.suitability || {};
  const amenities = raw.amenities || {};

  // ------------------------------
  // Google Details enrichments
  // ------------------------------
  const openingHours =
    raw.currentOpeningHours || raw.regularOpeningHours || null;

  const websiteUri = raw.websiteUri || null;
  const phoneNumber = raw.phoneNumber || raw.internationalPhoneNumber || null;

  // ------------------------------
  // Temporary: category, keywords, priority
  // (These will be filled in Step 2 with classifyPoi)
  // ------------------------------
  const category = raw.category || raw.types || "unknown" ;
  const keywords = raw.keywords || [];
  const priority = raw.priority || 0;

  // ------------------------------
  // Return canonical shape
  // ------------------------------
  return {
    id,
    source,
    title,
    address,
    latitude,
    longitude,

    types,
    category,
    keywords,

    suitability,
    amenities,

    rating,
    userRatingsTotal,

    priority,
    googlePhotoUrls,

    openingHours,
    websiteUri,
    phoneNumber,
    crRatings: raw.crRatings || null,

  };
}

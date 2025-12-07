// resolvePlaceMode.js
// -----------------------------------------------------------------------------
// Single source of truth for PlaceCard behavior.
// Determines ADD / EDIT / VIEW mode and permissions.
// -----------------------------------------------------------------------------

export function resolvePlaceMode({ place, user }) {
  if (!place) {
    return {
      mode: "view",
      canEdit: false,
      canRate: false,
      canComment: false,
      isExistingCafe: false,
      isGoogleOnly: false,
      reason: "No place provided",
    };
  }

  // ---------------------------------------------------------
  // USER PERMISSIONS
  // ---------------------------------------------------------
  const role = user?.role || "guest";

  const canEdit = role === "pro" || role === "admin";
  const canComment = role !== "guest";
  const canRate = role !== "guest";

  // ---------------------------------------------------------
  // CAFÉ IDENTIFICATION
  // ---------------------------------------------------------
  const isExistingCafe = !!place.cafeId;

  const isGoogleOnly = !place.cafeId && !!place.placeId;

  // Draft = new place initiated by POI tap or search
  const isDraft = !isExistingCafe && !isGoogleOnly;

  // ---------------------------------------------------------
  // DETERMINE MODE
  // ---------------------------------------------------------

  // 1) ADD MODE → A brand new café (no cafeId, not Google-only)
  if (isDraft) {
    return {
      mode: "add",
      canEdit: true,     // always editable
      canRate: false,    // cannot rate until saved
      canComment: false, // cannot comment until saved
      isExistingCafe: false,
      isGoogleOnly: false,
      reason: "Draft/new café",
    };
  }

  // 2) EDIT MODE → An existing CR Café AND user has permission
  if (isExistingCafe) {
    return {
      mode: canEdit ? "edit" : "view",
      canEdit,
      canRate,
      canComment,
      isExistingCafe: true,
      isGoogleOnly: false,
      reason: "Existing Coffee Rider café",
    };
  }

  // 3) VIEW MODE → A Google-only place (not in CR)
  if (isGoogleOnly) {
    return {
      mode: "view",
      canEdit: false,
      canRate: false,
      canComment: false,
      isExistingCafe: false,
      isGoogleOnly: true,
      reason: "Google-only place",
    };
  }

  // Fallback view
  return {
    mode: "view",
    canEdit: false,
    canRate: false,
    canComment: false,
    isExistingCafe: false,
    isGoogleOnly: false,
    reason: "Fallback",
  };
}

// capabilities.js

export const CAPABILITY_LEVELS = {
  GUEST: "guest",
  USER: "user",
  PRO: "pro",
  ADMIN: "admin",
};

export function getCapabilities(role = CAPABILITY_LEVELS.GUEST) {
  switch (role) {
    case CAPABILITY_LEVELS.ADMIN:
      return {
        // Core access
        canViewMap: true,
        canViewPlacecard: true,

        // Navigation & routing
        canNavigate: true,               // native maps, single destination
        canPreviewSingleRoute: true,     // Google Directions (single)
        canCreateRoutes: true,           // waypoints, multi-stop

        // Places & content
        canAddVenue: true,
        canRate: true,
        canComment: true,
        canUploadPhotos: true,
        canUpdatePlaces: true,

        // Routes
        canSaveRoutes: true,
        canShareRoutes: true,

        // Search
        canSearchCR: true,
        canSearchGoogle: true,

        // Google photos
        googlePhotoAccess: "full",

        // Admin
        canEditAnyVenue: true,
        canDeleteAnyVenue: true,
        canModerateUsers: true,
      };

    case CAPABILITY_LEVELS.PRO:
      return {
        canViewMap: true,
        canViewPlacecard: true,

        canNavigate: true,
        canPreviewSingleRoute: true,
        canCreateRoutes: true,

        canAddVenue: true,
        canRate: true,
        canComment: true,
        canUploadPhotos: true,
        canUpdatePlaces: true,

        canSaveRoutes: true,
        canShareRoutes: true,

        canSearchCR: true,
        canSearchGoogle: true,

        googlePhotoAccess: "full",
      };

    case CAPABILITY_LEVELS.USER:
      return {
        canViewMap: true,
        canViewPlacecard: true,

        canNavigate: true,
        canPreviewSingleRoute: true,   // ✅ this is the key upgrade
        canCreateRoutes: false,        // ❌ no waypoints

        canAddVenue: true,
        canRate: true,
        canComment: true,
        canUploadPhotos: true,
        canUpdatePlaces: false,

        canSaveRoutes: true,           // auto-saved, hidden
        canShareRoutes: false,

        canSearchCR: true,
        canSearchGoogle: false,

        googlePhotoAccess: "limited",  // 1–2 photos per place
      };

    case CAPABILITY_LEVELS.GUEST:
    default:
      return {
        canViewMap: true,
        canViewPlacecard: true,

        canNavigate: true,             // native maps only
        canPreviewSingleRoute: false,
        canCreateRoutes: false,

        canAddVenue: false,
        canRate: false,
        canComment: false,
        canUploadPhotos: false,
        canUpdatePlaces: false,

        canSaveRoutes: false,
        canShareRoutes: false,

        canSearchCR: true,
        canSearchGoogle: false,

        googlePhotoAccess: "none",
      };
  }
}

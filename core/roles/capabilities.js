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
        // Admin flag
        isAdmin: true,

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
        canCreateCrPlaces: true,

        // Routes
        canSaveRoutes: true,
        canShareRoutes: true,
        canAccessGroups: true,

        // Search
        canSearchCR: true,
        canSearchGoogle: true,

        // Google photos
        googlePhotoAccess: "full",
        canViewGooglePhotos: true,

        // Admin
        canEditAnyVenue: true,
        canDeleteAnyVenue: true,
        canModerateUsers: true,
      };

    case CAPABILITY_LEVELS.PRO:
      return {
        isAdmin: false,

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
        canCreateCrPlaces: true,

        canSaveRoutes: true,
        canShareRoutes: true,
        canAccessGroups: true,

        canSearchCR: true,
        canSearchGoogle: true,

        googlePhotoAccess: "full",
        canViewGooglePhotos: true,
      };

    case CAPABILITY_LEVELS.USER:
      return {
        isAdmin: false,

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
        canAccessGroups: false,

        canSearchCR: true,
        canSearchGoogle: false,

        googlePhotoAccess: "limited",  // 1–2 photos per place
        canViewGooglePhotos: true,
      };

    case CAPABILITY_LEVELS.GUEST:
    default:
      return {
        isAdmin: false,

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
        canAccessGroups: false,

        canSearchCR: true,
        canSearchGoogle: false,

        googlePhotoAccess: "none",
        canViewGooglePhotos: false,
      };
  }
}

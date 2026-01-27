// capabilities.js

export const CAPABILITY_LEVELS = {
  GUEST: "guest",
  USER: "user",
  PLACE_OWNER: "place-owner",
  PRO: "pro",
  ADMIN: "admin",
};

export function getCapabilities(role = CAPABILITY_LEVELS.GUEST) {
  switch (role) {
    case CAPABILITY_LEVELS.ADMIN:
      return {
        // Admin flag
        isAdmin: true,

        // Tab access
        canAccessMap: true,
        canAccessSavedRoutes: true,
        canAccessGroups: true,
        canAccessCalendar: true,
        canAccessProfile: true,

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

        // Search
        canSearchCR: true,
        canSearchGoogle: true,

        // Google photos
        googlePhotoAccess: "full",
        canViewGooglePhotos: true,

        // Calendar & Events
        canCreateEvents: true,
        canAccessSponsorship: true,

        // Admin
        canEditAnyVenue: true,
        canDeleteAnyVenue: true,
        canModerateUsers: true,
      };

    case CAPABILITY_LEVELS.PRO:
      return {
        isAdmin: false,

        // Tab access
        canAccessMap: true,
        canAccessSavedRoutes: true,
        canAccessGroups: true,
        canAccessCalendar: true,
        canAccessProfile: true,

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
        canShareEvents: true,

        canSearchCR: true,
        canSearchGoogle: true,

        googlePhotoAccess: "full",
        canViewGooglePhotos: true,

        // Calendar & Events
        canCreateEvents: true,
        canAccessSponsorship: false,
      };

    case CAPABILITY_LEVELS.PLACE_OWNER:
      return {
        isAdmin: false,

        // Tab access
        canAccessMap: true,
        canAccessSavedRoutes: false,
        canAccessGroups: false,
        canAccessCalendar: true,
        canAccessProfile: true,

        // Core access
        canViewMap: true,
        canViewPlacecard: true,

        // Navigation & routing
        canNavigate: false,
        canPreviewSingleRoute: true,
        canCreateRoutes: false,

        // Places & content
        canAddVenue: false,
        canRate: true,
        canComment: true,
        canUploadPhotos: false,
        canUpdatePlaces: true,         // own place only
        canCreateCrPlaces: false,

        // Routes
        canSaveRoutes: true,
        canShareRoutes: false,
        canShareEvents: true,

        // Search
        canSearchCR: true,
        canSearchGoogle: false,

        googlePhotoAccess: "limited",
        canViewGooglePhotos: true,

        // Calendar & Events
        canCreateEvents: true,
        canAccessSponsorship: true,
      };

    case CAPABILITY_LEVELS.USER:
      return {
        isAdmin: false,

        // Tab access
        canAccessMap: true,
        canAccessSavedRoutes: true,
        canAccessGroups: false,
        canAccessCalendar: false,
        canAccessProfile: true,

        canViewMap: true,
        canViewPlacecard: true,

        canNavigate: false,
        canPreviewSingleRoute: true,   // ✅ this is the key upgrade
        canCreateRoutes: false,        // ❌ no waypoints

        canAddVenue: true,
        canRate: true,
        canComment: true,
        canUploadPhotos: false,
        canUpdatePlaces: false,

        canSaveRoutes: true,           // auto-saved, hidden
        canShareRoutes: false,

        canSearchCR: true,
        canSearchGoogle: false,

        googlePhotoAccess: "limited",  // 1–2 photos per place
        canViewGooglePhotos: true,

        // Calendar & Events
        canCreateEvents: false,
        canAccessSponsorship: false,
      };

    case CAPABILITY_LEVELS.GUEST:
    default:
      return {
        isAdmin: false,

        // Tab access - Guest can see map and profile tabs only
        canAccessMap: true,
        canAccessSavedRoutes: false,
        canAccessGroups: false,
        canAccessCalendar: false,
        canAccessProfile: true,         // shows login/register

        canViewMap: true,
        canViewPlacecard: true,

        canNavigate: false,             // native maps only
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
        canViewGooglePhotos: false,

        // Calendar & Events
        canCreateEvents: false,
        canAccessSponsorship: false,
      };
  }
}

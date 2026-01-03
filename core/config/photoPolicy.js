export const PHOTO_POLICY = {
  guest: {
    viewCrPhotos: false,
    viewGooglePhotos: false,
    maxCrUploads: 0,
  },
  user: {
    viewCrPhotos: true,
    viewGooglePhotos: false,
    maxCrUploads: 1,
  },
  pro: {
    viewCrPhotos: true,
    viewGooglePhotos: true,
    maxCrUploads: 10,
  },
  admin: {
    viewCrPhotos: true,
    viewGooglePhotos: true,
    maxCrUploads: 50,
  },
};

export const GOOGLE_PHOTO_LIMITS = {
  maxPhotosPerPlace: 2,
  maxWidth: 400,
  maxPerSession: 20,
};

export const ENABLE_GOOGLE_PHOTOS = true;

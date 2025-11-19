import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_PLACES_API_KEY
} from "./config/env.js";

export default {
  expo: {
    name: "coffee-rider-v2",
    slug: "coffee-rider-v2",

    // ---- FIXED: everything in ONE extra block ----
    extra: {
      eas: {
        projectId: "93932a29-f9a5-4f08-8b1d-6c9030e8bc59"
      },
      googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      googlePlacesApiKey: GOOGLE_PLACES_API_KEY,
    },

    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Coffee Rider collects your location for group rides and navigation."
        }
      ],
      ["expo-maps"]
    ],

    ios: {
      supportsTablet: true,
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY
      }
    },

    android: {
      package: "com.timmy.marler.coffeeriderv2",
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      }
    },

    assetBundlePatterns: ["**/*"],
  }
};

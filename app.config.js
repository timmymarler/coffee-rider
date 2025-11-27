import "dotenv/config";

// Read the app variant from ENV or default to rider
const APP_NAME = process.env.APP_NAME || "rider";

// Brand folders for icons & splash
const BRAND_ASSETS = {
  rider: "assets/rider",
  driver: "assets/driver",
  strider: "assets/strider"
};

const DISPLAY_NAME = {
  rider: "Coffee Rider",
  driver: "Coffee Driver",
  strider: "Coffee Strider"
};

const SLUG = {
  rider: "coffee-rider-v2",
  driver: "coffee-driver-v2",
  strider: "coffee-strider-v2"
};

const ANDROID_PACKAGE = {
  rider: "com.timmy.marler.coffeerider",
  driver: "com.timmy.marler.coffeedriver",
  strider: "com.timmy.marler.coffeestrider"
};

const IOS_BUNDLE = {
  rider: "com.timmy.marler.coffeerider",
  driver: "com.timmy.marler.coffeedriver",
  strider: "com.timmy.marler.coffeestrider"
};

const brandFolder = BRAND_ASSETS[APP_NAME];

export default {
  expo: {
    name: DISPLAY_NAME[APP_NAME],
    slug: SLUG[APP_NAME],
    scheme: SLUG[APP_NAME],

    plugins: ["expo-maps"],
    
    icon: `${brandFolder}/icon.png`,
    splash: {
      image: `${brandFolder}/splash.png`,
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },

    assetBundlePatterns: ["**/*"],

    extra: {
      appName: APP_NAME,

      eas: {
        projectId: "93932a29-f9a5-4f08-8b1d-6c9030e8bc59"
      },

      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,

      firebase: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain: "coffee-rider-bea88.firebaseapp.com",
        projectId: "coffee-rider-bea88",
        storageBucket: "coffee-rider-bea88.firebasestorage.app",
        messagingSenderId: "1001945286149",
        appId: "1:1001945286149:web:93cae68a7354a0dd1e7e6c"
      }
    },

    ios: {
      bundleIdentifier: IOS_BUNDLE[APP_NAME]
    },

    android: {
      package: ANDROID_PACKAGE[APP_NAME],
      permissions: [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        foregroundImage: `${brandFolder}/adaptive-icon.png`,
        backgroundColor: "#FFFFFF"
      }
    }
  }
};

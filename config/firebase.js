// config/firebase.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from 'react-native';

// Use these variables wherever you need the keys
// Pull firebase config from app.config.js → extra.firebase
const { firebase } = Constants.expoConfig.extra;

const firebaseConfig = {
  apiKey:
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_FIREBASE_API_KEY_IOS
      : process.env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID,

  googleMapsApiKey:
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS
      : process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,

  googlePlacesApiKey:
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_IOS
      : process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_ANDROID,

  authDomain: firebase.authDomain,
  projectId: firebase.projectId,
  storageBucket: firebase.storageBucket,
  messagingSenderId: firebase.messagingSenderId,
  appId: firebase.appId,
};

// Initialise
const app = initializeApp(firebaseConfig);

// Export singletons
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

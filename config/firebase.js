// config/firebase.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Pull firebase config and API keys from app.config.js → extra
const { firebase, googleMapsApiKey, googlePlacesApiKey } = Constants.expoConfig.extra;

const firebaseConfig = {
  apiKey: firebase.apiKey,
  googleMapsApiKey,
  googlePlacesApiKey,
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

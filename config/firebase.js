// firebase.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ✅ Your current Firebase config for the project "coffee-rider-bea88"
const firebaseConfig = {
  apiKey: "AIzaSyCreZstfHnXYWJx5QfaZdcWvoxNCMyLDHg",
  authDomain: "coffee-rider-bea88.firebaseapp.com",
  projectId: "coffee-rider-bea88",
  // 👇 Important: new bucket domain, not appspot.com
  storageBucket: "coffee-rider-bea88.firebasestorage.app",
  messagingSenderId: "1001945286149",
  appId: "1:1001945286149:web:93cae68a7354a0dd1e7e6c"
};

// ✅ Initialize app
export const app = initializeApp(firebaseConfig);

// ✅ Auth (for React Native persistence)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// ✅ Firestore
export const db = getFirestore(app);

// ✅ Storage (will automatically point to your .firebasestorage.app bucket)
export const storage = getStorage(app);

export const GOOGLE_API_KEY = firebaseConfig.apiKey;


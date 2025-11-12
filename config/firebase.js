// config/firebase.js
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCreZstfHnXYWJx5QfaZdcWvoxNCMyLDHg",
  authDomain: "coffee-rider-bea88.firebaseapp.com",
  projectId: "coffee-rider-bea88",
  storageBucket: "coffee-rider-bea88.firebasestorage.app",
  messagingSenderId: "1001945286149",
  appId: "1:1001945286149:web:93cae68a7354a0dd1e7e6c",
  measurementId: "G-PEYX060N9D"
};

// Initialize only once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Export services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// DO NOT import getAnalytics() — not supported in Expo
export default app;


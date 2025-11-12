import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCreZstfHnXYWJx5QfaZdcWvoxNCMyLDHg",
  authDomain: "coffee-rider-bea88.firebaseapp.com",
  projectId: "coffee-rider-bea88",
  storageBucket: "coffee-rider-bea88.appspot.com",
  messagingSenderId: "1001945286149",
  appId: "1:1001945286149:web:93cae68a7354a0dd1e7e6c"
};

export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);

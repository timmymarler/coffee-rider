import { addDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

// Save a route for the current user
export async function saveFavouriteRoute(user, routeData) {
  if (!user) throw new Error("Not logged in");

  const route = {
    ...routeData,
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, `users/${user.uid}/favouriteRoutes`), route);
  return true;
}

// Fetch all favourite routes for a user
export async function loadFavouriteRoutes(user) {
  if (!user) return [];

  const snapshot = await getDocs(collection(db, `users/${user.uid}/favouriteRoutes`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

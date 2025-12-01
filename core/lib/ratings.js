import { db } from "@/config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

// Add or update a user's Coffee Rider rating + comment
export async function submitCRRating(cafeId, userId, userName, rating, comment) {
  const ref = doc(db, "cafes", cafeId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Cafe document not found.");

  const data = snap.data();
  const existing = data.crRatings || {
    average: 0,
    count: 0,
    users: {},
    comments: [],
  };

  // Update user rating data
  existing.users[userId] = {
    rating,
    comment,
  };

  // Update comments list (replace yours if already there)
  existing.comments = [
    ...existing.comments.filter((c) => c.userId !== userId),
    {
      userId,
      userName,
      rating,
      text: comment,
      timestamp: Date.now(),
    },
  ];

  // Recalculate averages
  const ratingsArray = Object.values(existing.users).map((u) => u.rating);
  const avg =
    ratingsArray.reduce((sum, v) => sum + v, 0) / ratingsArray.length;

  existing.average = Number(avg.toFixed(2));
  existing.count = ratingsArray.length;

  await updateDoc(ref, {
    crRatings: existing,
  });

  return existing;
}

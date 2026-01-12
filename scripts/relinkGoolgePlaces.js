import axios from "axios";
import admin from "firebase-admin";
import fs from "fs";

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync("./serviceAccount.json"))
  ),
});

const db = admin.firestore();

const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

async function findGoogleMatch(place) {
  const query = `${place.title} ${place.address || ""}`;

  const url = "https://maps.googleapis.com/maps/api/place/textsearch/json";

  const res = await axios.get(url, {
    params: {
      query,
      key: GOOGLE_KEY,
    },
  });

  const results = res.data.results || [];
  if (!results.length) return null;

  const best = results[0];

  // simple confidence check (distance + name similarity could be added later)
  return {
    place_id: best.place_id,
    name: best.name,
    address: best.formatted_address,
  };
}

async function run() {
  const snap = await db.collection("places").get();

  let updated = 0;

  for (const doc of snap.docs) {
    const place = doc.data();

    if (place.googlePlaceId) {
      console.log("✔ already linked:", place.title);
      continue;
    }

    console.log("🔍 matching:", place.title);

    const match = await findGoogleMatch(place);

    if (!match) {
      console.log("❌ no match found");
      continue;
    }

    console.log("➡ matched to:", match.name);

    await doc.ref.update({
      googlePlaceId: match.place_id,
      googleLinkedAt: new Date(),
    });

    updated++;
  }

  console.log("Done. Updated:", updated);
}

run().catch(console.error);

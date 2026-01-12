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

  return {
    place_id: best.place_id,
    name: best.name,
    address: best.formatted_address,
    lat: best.geometry.location.lat,
    lng: best.geometry.location.lng,
  };
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function run() {
  const snap = await db.collection("places").get();

  let candidates = 0;

  for (const doc of snap.docs) {
    const place = doc.data();

    if (place.googlePlaceId) {
      continue;
    }

    console.log("\n🔍 PLACE:", place.title);

    const match = await findGoogleMatch(place);

    if (!match) {
      console.log("   ❌ No Google match");
      continue;
    }

    const dist = distanceKm(
      { lat: place.latitude, lng: place.longitude },
      { lat: match.lat, lng: match.lng }
    );

    console.log("   ➜ Google match:", match.name);
    console.log("   ➜ Address:", match.address);
    console.log("   ➜ Distance:", dist.toFixed(2), "km");
    console.log("   ➜ Would assign googlePlaceId:", match.place_id);

    if (dist > 1) {
      console.log("   ⚠ WARNING: match distance > 1km");
    }

    candidates++;
  }

  console.log("\nDry run complete.");
  console.log("Candidates found:", candidates);
}

run().catch(console.error);

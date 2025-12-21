import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();

export const uploadImage = onRequest(async (req, res) => {
  try {
    // ---- Auth ----
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : null;

    if (!idToken) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // ---- Payload ----
    const { type, placeId, imageBase64 } = req.body;

    if (!type || !imageBase64) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    if (type === "place" && !placeId) {
      res.status(400).json({ error: "Missing placeId" });
      return;
    }

    // ---- Path ----
    let filePath;
    if (type === "place") {
      filePath = `places/${placeId}/${Date.now()}.jpg`;
    } else if (type === "profile") {
      filePath = `profilePhotos/${uid}/avatar.jpg`;
    } else {
      res.status(400).json({ error: "Invalid type" });
      return;
    }

    // ---- Upload ----
    const buffer = Buffer.from(imageBase64, "base64");
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);

    await file.save(buffer, {
      contentType: "image/jpeg",
      resumable: false,
    });

    await file.makePublic();

    res.json({
      ok: true,
      path: filePath,
      url: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
    });
  } catch (err) {
    console.error("[uploadImage]", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export async function uploadImageAsync(uri, storagePath) {
  if (!uri) return null;

  // 1. Read binary via fetch
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const binary = new Uint8Array(arrayBuffer);

  // 2. Correct bucket hostname from your config
  const bucket = "coffee-rider-bea88.firebasestorage.app";

  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/` +
    encodeURIComponent(storagePath) +
    `?uploadType=media`;

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
    },
    body: binary,
  });

  if (!uploadResponse.ok) {
    console.log("REST Upload Error:", await uploadResponse.text());
    throw new Error("Upload failed");
  }

  const result = await uploadResponse.json();

  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/` +
    encodeURIComponent(storagePath) +
    `?alt=media&token=${result.downloadTokens}`
  );
}

export const FUNCTION_URL =
  "https://us-central1-coffee-rider-bea88.cloudfunctions.net/uploadImage";

export async function uploadImage({
  user,
  type,        // "place" | "profile"
  placeId,     // required for "place"
  imageBase64,
}) {
  if (!user) {
    throw new Error("uploadImage called without user");
  }

  const token = await user.getIdToken();

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type,
      placeId,
      imageBase64,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json(); // { ok, path, url }
}

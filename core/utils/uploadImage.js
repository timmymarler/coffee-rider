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

  console.log('[uploadImage] Calling function with:', {
    type,
    placeId,
    imageBase64Length: imageBase64?.length || 0,
  });

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

  console.log('[uploadImage] Response status:', res.status);

  if (!res.ok) {
    const text = await res.text();
    console.log('[uploadImage] Error response:', text);
    throw new Error(text);
  }

  const result = await res.json();
  console.log('[uploadImage] Success:', { path: result.path, urlLength: result.url?.length });
  return result; // { ok, path, url }
}

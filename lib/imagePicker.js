import * as ImagePicker from "expo-image-picker";

/**
 * Opens the user's gallery and returns a URI.
 * Returns null if cancelled.
 * Fully cross-platform: Android + iOS.
 */
export async function pickImageSquare() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.cancelled || result.canceled) return null;
  return result.assets[0].uri;
}

/**
 * Same as above but without enforcing a square crop.
 */
export async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false, // user picks any shape
    quality: 0.85,
  });

  if (result.cancelled || result.canceled) return null;
  return result.assets[0].uri;
}

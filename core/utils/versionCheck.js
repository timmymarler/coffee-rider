import { db } from "@config/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Fetch version info from Firestore
 * Expected Firestore structure: /versions/{appName}
 * Document fields: latestVersion, minimumVersion, releaseNotes
 */
export async function fetchVersionInfo(appName = "rider") {
  try {
    const docRef = doc(db, "versions", appName);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.warn("[VERSION] No version doc found for", appName);
      return null;
    }

    return docSnap.data();
  } catch (error) {
    console.error("[VERSION] Failed to fetch version info:", error);
    return null;
  }
}

/**
 * Compare version strings (e.g., "1.2.3")
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
export function compareVersions(v1, v2) {
  const parts1 = (v1 || "0.0.0").split(".").map(Number);
  const parts2 = (v2 || "0.0.0").split(".").map(Number);

  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * Check version status
 * Returns: { status, hasUpdate, isRequired, versionInfo }
 * status: "current" | "update-available" | "update-required"
 */
export function checkVersionStatus(currentVersion, versionInfo) {
  if (!versionInfo) {
    return {
      status: "current",
      hasUpdate: false,
      isRequired: false,
      versionInfo: null,
    };
  }

  const { latestVersion, minimumVersion } = versionInfo;

  // Check if update is required
  if (minimumVersion && compareVersions(currentVersion, minimumVersion) < 0) {
    return {
      status: "update-required",
      hasUpdate: true,
      isRequired: true,
      versionInfo,
    };
  }

  // Check if update is available
  if (latestVersion && compareVersions(currentVersion, latestVersion) < 0) {
    return {
      status: "update-available",
      hasUpdate: true,
      isRequired: false,
      versionInfo,
    };
  }

  return {
    status: "current",
    hasUpdate: false,
    isRequired: false,
    versionInfo,
  };
}

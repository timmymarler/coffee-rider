import { db } from "@/config/firebase";
import Constants from "expo-constants";
import { doc, getDoc } from "firebase/firestore";

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkAppVersion() {
  const currentVersion =
    Constants.expoConfig?.version ||
    Constants.manifest?.version;
console.log("APP VERSION:", currentVersion);

  if (!currentVersion) return null;

  const snap = await getDoc(doc(db, "appConfig", "version"));
  if (!snap.exists()) return null;

  const config = snap.data();

  return {
    currentVersion,
    latest: config.latest,
    minRequired: config.minRequired,
    forceUpdate: config.forceUpdate,
    compareLatest: compareVersions(currentVersion, config.latest),
    compareMin: compareVersions(currentVersion, config.minRequired),
  };
}

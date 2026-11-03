import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";

/**
 * iOS locked-screen navigation support.
 *
 * The foreground location watcher sets allowsBackgroundLocationUpdates=false on
 * iOS, so updates stop when the phone locks. A background location task keeps
 * updates flowing while Follow Me is active, which keeps voice guidance and BLE
 * pod messages alive with the screen locked.
 */
export const BACKGROUND_NAVIGATION_TASK = "coffee-rider-background-navigation";

const listeners = new Set();
let taskDefined = false;

function ensureTaskDefined() {
  if (taskDefined || Platform.OS !== "ios") return;
  taskDefined = true;
  TaskManager.defineTask(BACKGROUND_NAVIGATION_TASK, ({ data, error }) => {
    if (error) {
      console.warn("[BackgroundNav] Location task error:", error.message || error);
      return;
    }
    // Foreground updates are already handled by the in-screen watcher.
    if (AppState.currentState === "active") return;
    const locations = data?.locations;
    const latest = Array.isArray(locations) ? locations[locations.length - 1] : null;
    if (!latest?.coords) return;
    listeners.forEach((listener) => {
      try {
        listener(latest);
      } catch (listenerError) {
        console.warn("[BackgroundNav] Listener error:", listenerError?.message || listenerError);
      }
    });
  });
}

export function addBackgroundNavigationListener(listener) {
  ensureTaskDefined();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function startBackgroundNavigationLocation() {
  if (Platform.OS !== "ios") return false;
  ensureTaskDefined();
  const permission = await Location.requestBackgroundPermissionsAsync();
  if (permission.status !== "granted") {
    console.warn("[BackgroundNav] Background location permission not granted; locked-screen navigation unavailable");
    return false;
  }
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_NAVIGATION_TASK).catch(() => false);
  if (alreadyStarted) return true;
  await Location.startLocationUpdatesAsync(BACKGROUND_NAVIGATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 1000,
    distanceInterval: 5,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
  console.log("[BackgroundNav] Background location updates started");
  return true;
}

export async function stopBackgroundNavigationLocation() {
  if (Platform.OS !== "ios") return;
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_NAVIGATION_TASK).catch(() => false);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(BACKGROUND_NAVIGATION_TASK).catch((error) => {
    console.warn("[BackgroundNav] Stop failed:", error?.message || error);
  });
  console.log("[BackgroundNav] Background location updates stopped");
}

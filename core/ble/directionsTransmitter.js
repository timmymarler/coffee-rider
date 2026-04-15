import Constants from "expo-constants";

const DEFAULT_SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const DEFAULT_CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890ac";
const DEFAULT_DEVICE_NAME = "CR-Directions";
const MIN_SEND_INTERVAL_MS = 250;

const bleConfig = Constants.expoConfig?.extra?.bleDirections || {};

let customTransport = null;
let warnedNoTransport = false;
let lastPayload = null;
let lastSentAt = 0;

function isEnabled() {
  return bleConfig.enabled === true || bleConfig.enabled === "true";
}

function compact(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const output = String(value).replace(/\s+/g, " ").trim();
  return output.length ? output : fallback;
}

function normalizeManeuver(maneuver) {
  const upper = compact(maneuver, "STRAIGHT").toUpperCase();
  if (upper.includes("ROUNDABOUT")) return "ROUNDABOUT";
  if (upper.includes("UTURN") || upper.includes("U_TURN")) return "UTURN";
  if (upper.includes("ARRIVE") || upper.includes("DESTINATION")) return "ARRIVE";
  if (upper.includes("LEFT")) return "LEFT";
  if (upper.includes("RIGHT")) return "RIGHT";
  return "STRAIGHT";
}

function normalizeAngle(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return String(Math.round(((num % 360) + 360) % 360));
}

function normalizeExitNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "";
  return String(Math.round(num));
}

function encodePayload({ maneuver, distance, instruction, roundaboutAngle, roundaboutExitNumber }) {
  const safeManeuver = normalizeManeuver(maneuver);
  const safeDistance = compact(distance, "--");
  const safeInstruction = compact(instruction, "Continue");
  const safeRoundaboutAngle = normalizeAngle(roundaboutAngle);
  const safeRoundaboutExitNumber = normalizeExitNumber(roundaboutExitNumber);
  // Extended payload format:
  // MANEUVER|DISTANCE|INSTRUCTION|ROUNDABOUT_ANGLE|ROUNDABOUT_EXIT_NUMBER
  return `${safeManeuver}|${safeDistance}|${safeInstruction}|${safeRoundaboutAngle}|${safeRoundaboutExitNumber}`;
}

function resolveTransport() {
  if (typeof customTransport === "function") return customTransport;

  const globalTransport = globalThis?.__CR_BLE_DIRECTIONS_SEND__;
  if (typeof globalTransport === "function") {
    return globalTransport;
  }

  return null;
}

export function setBleDirectionsTransport(fn) {
  customTransport = typeof fn === "function" ? fn : null;
  warnedNoTransport = false;
}

export async function sendBleDirectionsFrame(frame) {
  if (!isEnabled()) {
    return false;
  }

  const payload = encodePayload(frame || {});
  const now = Date.now();

  // Avoid flooding BLE with identical frames.
  if (payload === lastPayload) {
    return false;
  }

  if (now - lastSentAt < MIN_SEND_INTERVAL_MS) {
    return false;
  }

  const transport = resolveTransport();
  if (!transport) {
    if (!warnedNoTransport) {
      warnedNoTransport = true;
      console.warn("[BLE_DIRECTIONS] Enabled but no transport configured. Set globalThis.__CR_BLE_DIRECTIONS_SEND__.");
    }
    return false;
  }

  try {
    await Promise.resolve(
      transport(payload, {
        serviceUuid: bleConfig.serviceUuid || DEFAULT_SERVICE_UUID,
        characteristicUuid: bleConfig.characteristicUuid || DEFAULT_CHARACTERISTIC_UUID,
        deviceName: bleConfig.deviceName || DEFAULT_DEVICE_NAME,
      })
    );
    lastPayload = payload;
    lastSentAt = now;
    return true;
  } catch (error) {
    console.warn("[BLE_DIRECTIONS] Failed to send payload:", error?.message || error);
    return false;
  }
}

export function getBleDirectionsConfig() {
  return {
    enabled: isEnabled(),
    serviceUuid: bleConfig.serviceUuid || DEFAULT_SERVICE_UUID,
    characteristicUuid: bleConfig.characteristicUuid || DEFAULT_CHARACTERISTIC_UUID,
    deviceName: bleConfig.deviceName || DEFAULT_DEVICE_NAME,
  };
}

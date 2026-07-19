import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  IOS_SUBSCRIPTIONS_DISABLED_MESSAGE,
  IOS_SUBSCRIPTIONS_TEMP_DISABLED,
  RESTRICTED_FREE_ACCESS_WINDOW_DAYS,
} from "@core/config/launchFlags";
import { Alert, Platform, ToastAndroid } from "react-native";

export const PRO_UPGRADE_TITLE = "Unlock all Pro benefits";
function toMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value?.seconds && Number.isFinite(value.seconds)) return value.seconds * 1000;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getRestrictedAccessDaysRemaining(createdAtValue, nowMs = Date.now()) {
  const createdAtMs = toMillis(createdAtValue);
  if (!Number.isFinite(createdAtMs)) return null;

  const windowMs = RESTRICTED_FREE_ACCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const expiresAtMs = createdAtMs + windowMs;
  const remainingDays = Math.ceil((expiresAtMs - nowMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, remainingDays);
}

export function buildRestrictedAccessMessage(createdAtValue) {
  const daysRemaining = getRestrictedAccessDaysRemaining(createdAtValue);

  if (daysRemaining === null) {
    return `You are on the Free plan. Restricted access lasts ${RESTRICTED_FREE_ACCESS_WINDOW_DAYS} days from sign up. Upgrade to Pro for unlimited route planning and route saving.`;
  }

  if (daysRemaining <= 0) {
    return "Your restricted free access has ended. Upgrade to Pro to continue using Pro features.";
  }

  return `You are on the Free plan. ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} of restricted access remaining. Upgrade to Pro for unlimited route planning and route saving.`;
}

export const PRO_UPGRADE_MESSAGE = buildRestrictedAccessMessage(null);
export const PRO_UPGRADE_PROMPT_QUEUE_KEY = "@coffee_rider_upgrade_prompt_queue";
export const BETA_PRO_EXPIRY_ISO = "2026-05-31T23:59:59.999Z";
export const BETA_PRO_EXPIRY_LABEL = "31 May 2026";

export function getBetaProFields() {
  const expiresAtMs = Date.parse(BETA_PRO_EXPIRY_ISO);
  return {
    role: "pro",
    subscriptionStatus: "active",
    subscriptionPlan: "beta",
    subscriptionExpiresAt: expiresAtMs,
    betaProgram: {
      enabled: true,
      expiresAt: expiresAtMs,
    },
  };
}

export function showBetaWelcomePrompt() {
  Alert.alert(
    "BETA Pro Activated",
    `You have been upgraded to Pro until ${BETA_PRO_EXPIRY_LABEL} as part of our BETA program. Please use the Report Issue button on the Profile screen for any problems or suggestions.`,
    [{ text: "OK" }]
  );
}

export function shouldShowProUpgradePrompt(role) {
  return role === "user";
}

export function showProUpgradePrompt(router, options = {}) {
  if (Platform.OS === "ios" && IOS_SUBSCRIPTIONS_TEMP_DISABLED) {
    const queuedPrompt = {
      title: "Soft launch access",
      message: IOS_SUBSCRIPTIONS_DISABLED_MESSAGE,
      createdAt: Date.now(),
    };

    AsyncStorage.setItem(PRO_UPGRADE_PROMPT_QUEUE_KEY, JSON.stringify(queuedPrompt)).catch((error) => {
      console.warn("[PRO_UPGRADE_PROMPT] Failed to queue prompt:", error);
    });
    return;
  }

  const title = options.title || PRO_UPGRADE_TITLE;
  const message = options.message || PRO_UPGRADE_MESSAGE;

  const queuedPrompt = {
    title,
    message,
    createdAt: Date.now(),
  };

  AsyncStorage.setItem(PRO_UPGRADE_PROMPT_QUEUE_KEY, JSON.stringify(queuedPrompt)).catch((error) => {
    console.warn("[PRO_UPGRADE_PROMPT] Failed to queue prompt:", error);
  });

  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.LONG);
  }
}

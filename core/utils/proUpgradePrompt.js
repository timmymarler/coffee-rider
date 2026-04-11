import { Alert } from "react-native";

export const PRO_UPGRADE_TITLE = "Unlock all Pro benefits";
export const PRO_UPGRADE_MESSAGE = "Unlock all the benefits you need by upgrading to a Pro account.";
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
  const title = options.title || PRO_UPGRADE_TITLE;
  const message = options.message || PRO_UPGRADE_MESSAGE;

  Alert.alert(title, message, [
    {
      text: "Cancel",
      style: "cancel",
    },
    {
      text: "Upgrade",
      onPress: () => {
        router?.push?.("/subscriptions");
      },
    },
  ]);
}

import { Alert } from "react-native";

export const PRO_UPGRADE_TITLE = "Unlock all Pro benefits";
export const PRO_UPGRADE_MESSAGE = "Unlock all the benefits you need by upgrading to a Pro account.";

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

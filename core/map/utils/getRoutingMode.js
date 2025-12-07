import { getTheme } from "@themes";

/**
 * Returns the routing mode based on the current app theme.
 * Rider  → driving (motorcycle-like)
 * Driver → driving
 * Strider → walking
 */
export function getRoutingMode() {
  const theme = getTheme();

  // theme.appType might be "rider", "driver", "strider"
  const appType = theme.appType || "rider";

  switch (appType.toLowerCase()) {
    case "rider":
      return "driving";

    case "driver":
      return "driving";

    case "strider":
      return "walking";

    default:
      return "driving";
  }
}

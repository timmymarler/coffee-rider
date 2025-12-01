// themes/brands/strider.js
import { tokens } from "../tokens";

const base = tokens.strider;
const neutral = tokens.neutral;
const status = tokens.status;
const route = tokens.route;

export default {
  colors: {
    primaryDark: base.primaryDark,
    primaryMid: base.primaryMid,
    primaryLight: base.primaryLight,

    background: base.background,
    surface: base.surface,

    accent: base.accent,
    accentLight: base.accentLight,

    text: neutral.textOnDark,
    textMuted: neutral.textMutedDark,

    border: neutral.borderDark,
    shadow: neutral.shadow,

    tabBackground: base.surface,
    tabActive: base.accent,
    tabInactive: neutral.textMutedDark,
    tabBorder: base.primaryDark,

    buttonPrimary: base.primaryMid,
    buttonText: neutral.textOnDark,
    cardBackground: base.surface,
    cardBorder: neutral.borderDark,

    mapSurface: neutral.backgroundLight,
    mapCard: neutral.surfaceLight,
    mapInput: neutral.surfaceLight,
    mapBorder: neutral.borderLight,
    mapShadow: neutral.shadow,

    error: status.error,
    warning: status.warning,
    success: status.success,

    routeStart: route.start,
    routeWaypoint: route.waypoint,
    routeEnd: route.end,
  },
};

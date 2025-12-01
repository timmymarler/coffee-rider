// themes/tokens.js
// Semantic tokens built from the raw palette.

import { palette } from "./palette";

export const tokens = {
  // Shared neutrals / base UI
  neutral: {
    backgroundLight: palette.neutral100,
    surfaceLight: palette.neutral200,
    backgroundDark: palette.neutral900,
    surfaceDark: palette.neutral800,

    textOnLight: palette.neutral900,
    textOnDark: palette.neutral100,
    textMutedLight: palette.neutral600,
    textMutedDark: palette.neutral400,

    borderLight: palette.neutral300,
    borderDark: palette.neutral700,

    shadow: "rgba(0,0,0,0.25)",
    overlay: "rgba(0,0,0,0.4)",
  },

  // Status / feedback
  status: {
    error: palette.red500,
    warning: palette.amber500,
    success: palette.success500,
  },

  // Route colours
  route: {
    start: palette.routeStart,
    waypoint: palette.routeWaypoint,
    end: palette.routeEnd,
  },

  // Brand base tokens for each app
  rider: {
    primaryDark: palette.blue800,
    primaryMid: palette.blue700,
    primaryLight: palette.blue500,
    background: palette.blue900,
    surface: palette.blue800,
    accent: palette.coffee500,
    accentLight: palette.coffee300,
  },

  driver: {
    primaryDark: palette.coffee800,
    primaryMid: palette.coffee700,
    primaryLight: palette.coffee500,
    background: palette.coffee900,
    surface: palette.coffee800,
    accent: palette.blue500,
    accentLight: palette.blue300,
  },

  strider: {
    primaryDark: palette.green800,
    primaryMid: palette.green700,
    primaryLight: palette.green500,
    background: palette.green900,
    surface: palette.green800,
    accent: palette.coffee500,
    accentLight: palette.coffee300,
  },
};

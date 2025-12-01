// themes/index.js

import colourBlind from "./accessibility/colourBlind";
import highContrast from "./accessibility/highContrast";
import driver from "./brands/driver";
import rider from "./brands/rider";
import strider from "./brands/strider";
import { mergeThemes } from "./merge";

const BRANDS = {
  rider,
  driver,
  strider,
};

export function getTheme({ brand = "rider", accessibility = "normal" } = {}) {
  let base = BRANDS[brand] || rider;

  if (accessibility === "highContrast") {
    return mergeThemes(base, highContrast);
  }

  if (accessibility === "colourBlind") {
    return mergeThemes(base, colourBlind);
  }

  return base;
}

// themes/palette.js
import { driverPalette } from "./brands/driver";
import { riderPalette } from "./brands/rider";
import { striderPalette } from "./brands/strider";

const brandPalettes = {
  rider: riderPalette,
  driver: driverPalette,
  strider: striderPalette,
};

export const getPalette = (appName = "rider") => {
  return brandPalettes[appName] ?? riderPalette;
};

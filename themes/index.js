// themes/index.js
import driver from "./driver";
import rider from "./rider";
import strider from "./strider";

// You decide which brand is active at build time
// For Coffee Rider:
const currentBrand = "strider";

const brands = {
  rider,
  driver,
  strider
};

export const theme = brands[currentBrand];
export default theme;

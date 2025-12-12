export const THEME_CONFIG = {
  rider: {
    categories: {
      cafe: {
        types: ["cafe", "coffee_shop", "bakery", "restaurant"],
        keywords: ["cafe", "coffee", "tea", "espresso"],
      },

      fuel: {
        types: ["gas_station"],
        keywords: ["fuel", "petrol", "gas"],
      },

      meeting: {
        types: ["parking", "point_of_interest"],
        keywords: ["meet", "meeting", "riders", "bikers"],
      },

      scenic: {
        types: ["tourist_attraction", "park"],
        keywords: ["view", "scenic", "lookout"],
      },
    },

    // CR suitability for Rider browsing mode
    defaultSuitability: ["bikers", "scooters"],

    // Which amenities belong to Rider filters (UI later)
    allowedAmenities: [
      "parking",
      "toilets",
      "outdoorSeating",
      "food",
    ],
  },
};

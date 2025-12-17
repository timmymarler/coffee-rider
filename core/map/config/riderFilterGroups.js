// core/map/config/riderFilterGroups.js

export const RIDER_FILTER_GROUPS = {
  cafe: {
    googleTypes: [
      "cafe",
      "coffee_shop",
      "tea_house",
      "bakery",
    ],
    keywords: ["cafe", "coffee", "espresso", "latte"],
  },

  food: {
    googleTypes: [
      "restaurant",
      "fast_food",
      "meal_takeaway",
      "food",
    ],
    keywords: ["restaurant", "bistro", "grill", "kitchen"],
  },

  pub: {
    googleTypes: ["bar", "pub"],
    keywords: ["pub", "inn", "tavern"],
  },

  fuel: {
    googleTypes: [
      "gas_station",
      "electric_vehicle_charging_station",
    ],
    keywords: ["fuel", "petrol", "diesel"],
  },

//  servicing: {
//    googleTypes: [
//      "motorcycle_repair",
//      "motorcycle_shop",
//      "car_repair",
//    ],
//    keywords: ["motorcycle", "garage", "service"],
//  },

  parking: {
    googleTypes: ["parking"],
    keywords: ["parking"],
  },

  scenic: {
    googleTypes: [
      "tourist_attraction",
      "park",
      "natural_feature",
    ],
    keywords: ["view", "scenic", "lookout"],
  },
};

export const POI_FILTERS = {
  rider: {
    allowedTypes: [
      "cafe",
      "coffee_shop",
      "bakery",
      "fast_food",
      "tourist_attraction",
      "gas_station",
      "parking",
    ],
    keywords: ["cafe", "coffee", "biker", "motorcycle", "motorbike", "scooter", "fuel", "tea", "scenic"],
    //keywords: ["fuel"],
  },

  driver: {
    allowedTypes: [
      "cafe",
      "coffee_shop",
      "bakery",
      "fast_food",
      "restaurant",
      "parking",
      "gas_station",
      "charging_station",
      "car_wash",
      "point_of_interest",
    ],
    keywords: ["cafe", "coffee", "parking", "fuel", "charger", "tea"],
  },

  strider: {
    allowedTypes: [
      "cafe",
      "coffee_shop",
      "bakery",
      "park",
      "tourist_attraction",
      "point_of_interest",
      "scenic_viewpoint",
    ],
    keywords: ["cafe", "coffee", "scenic", "walk", "trail", "tea"],
  },
};

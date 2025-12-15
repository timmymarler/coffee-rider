import { RIDER_TYPE_MAP } from "./riderTypeMap";

export const getTypesForFilters = (selectedCategories) => {
  // No filters → return theme defaults
  if (selectedCategories.size === 0) {
    return Object.values(RIDER_TYPE_MAP)
      .flat()
      .filter(Boolean);
  }

  const combined = new Set();
  selectedCategories.forEach((cat) => {
    const types = RIDER_TYPE_MAP[cat];
    if (types) types.forEach((t) => combined.add(t));
  });

  return Array.from(combined);
};

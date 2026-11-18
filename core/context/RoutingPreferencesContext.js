import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useEffect, useState } from "react";

const ROUTING_PREFERENCES_KEY = "routingPreferences";
const AVOID_KEYS = ["motorways", "tollRoads", "unpavedRoads", "ferries"];
const DEFAULT_AVOID_OPTIONS = {
  motorways: false,
  tollRoads: false,
  unpavedRoads: false,
  ferries: false,
};

export const RoutingPreferencesContext = createContext({
  theme: "rider",
  setTheme: () => {},
  routeType: "curvy",
  setRouteType: () => {},
  avoidMotorways: false,
  setAvoidMotorways: () => {},
  avoidOptions: DEFAULT_AVOID_OPTIONS,
  setAvoidOption: () => {},
  travelMode: "car",
  setTravelMode: () => {},
  customHilliness: "normal",
  setCustomHilliness: () => {},
  customWindingness: "normal",
  setCustomWindingness: () => {},
  restorePreferences: () => {},
  availableRouteTypes: [],
  resetToDefaults: () => {},
  getDefaultsForBrand: () => {},
});

// Theme-specific routing defaults with available route options per vehicle type
const THEME_CONFIGS = {
  rider: {
    travelMode: "motorcycle",
    defaultRouteType: "curvy",
    avoidKeys: AVOID_KEYS,
    routeTypes: [
      { id: "fastest", label: "⚡ Fastest", description: "Minimize travel time" },
      { id: "shortest", label: "📏 Shortest", description: "Minimize distance" },
      { id: "curvy", label: "🎢 Curvy", description: "Choose windingness and elevation" },
    ],
  },
  driver: {
    travelMode: "car",
    defaultRouteType: "fastest",
    avoidKeys: AVOID_KEYS,
    routeTypes: [
      { id: "fastest", label: "⚡ Fastest", description: "Minimize travel time" },
      { id: "shortest", label: "📏 Shortest", description: "Minimize distance" },
      { id: "curvy", label: "🎢 Curvy", description: "Choose windingness and elevation" },
    ],
  },
  strider: {
    travelMode: "pedestrian",
    defaultRouteType: "quietest",
    avoidKeys: ["ferries"],
    routeTypes: [
      { id: "shortest", label: "📏 Shortest", description: "Minimize distance" },
      { id: "quietest", label: "🌳 Quietest", description: "Fewest main roads" },
    ],
  },
  cyclist: {
    travelMode: "bike",
    defaultRouteType: "recommended",
    avoidKeys: ["ferries"],
    routeTypes: [
      { id: "recommended", label: "🚲 Recommended", description: "Google's cycling route via bike paths and preferred streets" },
      { id: "quietest", label: "🌳 Quietest", description: "Fewest main roads" },
      { id: "shortest", label: "📏 Shortest", description: "Minimize distance" },
    ],
  },
};

// Map vehicle IDs to theme names for UI
const VEHICLE_TO_THEME = {
  motorcycle: "rider",
  car: "driver",
  bike: "cyclist",
  pedestrian: "strider",
};

const ROUTE_TYPE_MAP = {
  curvy: { tomtomRouteType: "thrilling" },
  eco: { tomtomRouteType: "eco", hilliness: null, windingness: null }, // Fuel-efficient routing
  scenic: { tomtomRouteType: "thrilling", hilliness: "high", windingness: "normal" }, // Hilly scenic routes for pedestrians
  fastest: { tomtomRouteType: "fastest", hilliness: null, windingness: null }, // All roads for speed
  shortest: { tomtomRouteType: "shortest", hilliness: null, windingness: null }, // Minimize distance
};

export function RoutingPreferencesProvider({ children, brand = "rider", profileRoutingTheme = null }) {
  const [theme, setThemeState] = useState("rider");
  const [routeType, setRouteTypeState] = useState("curvy");
  const [avoidMotorways, setAvoidMotorwaysState] = useState(false);
  const [travelMode, setTravelModeState] = useState("car");
  const [customHilliness, setCustomHillinessState] = useState("normal");
  const [customWindingness, setCustomWindingnessState] = useState("normal");
  const [avoidOptions, setAvoidOptionsState] = useState(DEFAULT_AVOID_OPTIONS);
  const [isLoaded, setIsLoaded] = useState(false);
  const persistPreferences = useCallback((preferences) => {
    AsyncStorage.setItem(ROUTING_PREFERENCES_KEY, JSON.stringify(preferences))
      .catch(error => console.error("[RoutingPreferences] Error saving:", error));
  }, []);

  // Get available route types for current theme
  const getAvailableRouteTypes = useCallback((themeName = theme) => {
    return THEME_CONFIGS[themeName]?.routeTypes || [];
  }, [theme]);

  // Get defaults for a theme
  const getDefaultsForBrand = useCallback((themeName = theme) => {
    const config = THEME_CONFIGS[themeName] || THEME_CONFIGS.rider;
    return {
      travelMode: config.travelMode,
      routeType: config.defaultRouteType,
    };
  }, [theme]);

  // Load preferences from storage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const stored = JSON.parse(await AsyncStorage.getItem(ROUTING_PREFERENCES_KEY) || "null") || {};
        const storedTheme = THEME_CONFIGS[stored.theme] ? stored.theme : "rider";
        const defaults = getDefaultsForBrand(storedTheme);
        const allowedRouteTypes = THEME_CONFIGS[storedTheme].routeTypes.map(option => option.id);
        const legacyRouteType = stored.routeType;
        const migratedRouteType = ["twisty", "adventure", "custom"].includes(legacyRouteType)
          ? "curvy"
          : legacyRouteType === "eco" ? "fastest" : legacyRouteType;
        const validLevel = value => ["low", "normal", "high"].includes(value) ? value : "normal";
        const migratedLevels = {
          customWindingness: validLevel(stored.customWindingness || (legacyRouteType === "twisty" ? "high" : legacyRouteType === "curvy" ? "low" : null)),
          customHilliness: validLevel(stored.customHilliness || (legacyRouteType === "adventure" ? "high" : null)),
        };
        const storedAvoids = stored.avoidOptions || {};
        const nextAvoidOptions = {
          motorways: Boolean(storedAvoids.motorways ?? stored.avoidMotorways),
          tollRoads: Boolean(storedAvoids.tollRoads),
          unpavedRoads: Boolean(storedAvoids.unpavedRoads),
          ferries: Boolean(storedAvoids.ferries),
        };
        const nextRouteType = allowedRouteTypes.includes(migratedRouteType) ? migratedRouteType : defaults.routeType;
        setThemeState(storedTheme);
        setRouteTypeState(nextRouteType);
        setTravelModeState(defaults.travelMode);
        setCustomHillinessState(migratedLevels.customHilliness);
        setCustomWindingnessState(migratedLevels.customWindingness);
        setAvoidOptionsState(nextAvoidOptions);
        setAvoidMotorwaysState(nextAvoidOptions.motorways);
        await AsyncStorage.setItem(ROUTING_PREFERENCES_KEY, JSON.stringify({
          theme: storedTheme,
          routeType: nextRouteType,
          ...migratedLevels,
          avoidOptions: nextAvoidOptions,
        }));
      } catch (error) {
        console.error("[RoutingPreferences] Error loading preferences:", error);
        const defaults = getDefaultsForBrand("rider");
        setThemeState("rider");
        setTravelModeState(defaults.travelMode);
        setRouteTypeState(defaults.routeType);
        setCustomHillinessState("normal");
        setCustomWindingnessState("normal");
        setAvoidMotorwaysState(false);
        setAvoidOptionsState(DEFAULT_AVOID_OPTIONS);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPreferences();
  }, []);

  // The account's saved travel profile wins over this device's last local choice.
  useEffect(() => {
    if (!isLoaded || !THEME_CONFIGS[profileRoutingTheme]) return;
    const config = THEME_CONFIGS[profileRoutingTheme];
    const allowedRouteTypes = config.routeTypes.map(option => option.id);
    const nextRouteType = allowedRouteTypes.includes(routeType) ? routeType : config.defaultRouteType;
    setThemeState(profileRoutingTheme);
    setTravelModeState(config.travelMode);
    setRouteTypeState(nextRouteType);
    persistPreferences({ theme: profileRoutingTheme, routeType: nextRouteType, customHilliness, customWindingness, avoidOptions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, profileRoutingTheme]);

  // Set theme (vehicle type)
  const handleSetTheme = useCallback((newTheme) => {
    if (THEME_CONFIGS[newTheme]) {
      setThemeState(newTheme);
      const defaults = getDefaultsForBrand(newTheme);
      setTravelModeState(defaults.travelMode);
      setRouteTypeState(defaults.routeType);
      setCustomHillinessState("normal");
      setCustomWindingnessState("normal");
      setAvoidOptionsState(DEFAULT_AVOID_OPTIONS);
      setAvoidMotorwaysState(false);
      persistPreferences({ theme: newTheme, routeType: defaults.routeType, customHilliness: "normal", customWindingness: "normal", avoidOptions: DEFAULT_AVOID_OPTIONS });
    }
  }, [getDefaultsForBrand, persistPreferences]);

  const handleSetRouteType = useCallback((newRouteType) => {
    const allowedRouteTypes = THEME_CONFIGS[theme]?.routeTypes.map(option => option.id) || [];
    const migratedRouteType = ["twisty", "adventure", "custom"].includes(newRouteType) ? "curvy" : newRouteType;
    const routeTypeValue = allowedRouteTypes.includes(migratedRouteType)
      ? migratedRouteType
      : THEME_CONFIGS[theme]?.defaultRouteType || "fastest";
    setRouteTypeState(routeTypeValue);
    persistPreferences({ theme, routeType: routeTypeValue, customHilliness, customWindingness, avoidOptions });
  }, [theme, customHilliness, customWindingness, avoidOptions, persistPreferences]);

  const handleSetAvoidOption = useCallback((key, enabled) => {
    if (!AVOID_KEYS.includes(key)) return;
    const nextAvoidOptions = { ...avoidOptions, [key]: Boolean(enabled) };
    setAvoidOptionsState(nextAvoidOptions);
    setAvoidMotorwaysState(nextAvoidOptions.motorways);
    persistPreferences({ theme, routeType, customHilliness, customWindingness, avoidOptions: nextAvoidOptions });
  }, [theme, routeType, customHilliness, customWindingness, avoidOptions, persistPreferences]);

  const handleSetAvoidMotorways = useCallback((enabled) => {
    handleSetAvoidOption("motorways", enabled);
  }, [handleSetAvoidOption]);

  // Set custom hilliness for thrilling routes
  const handleSetCustomHilliness = useCallback((newHilliness) => {
    if (!["low", "normal", "high"].includes(newHilliness)) return;
    setCustomHillinessState(newHilliness);
    persistPreferences({ theme, routeType, customHilliness: newHilliness, customWindingness, avoidOptions });
  }, [theme, routeType, customWindingness, avoidOptions, persistPreferences]);

  // Set custom windingness for thrilling routes
  const handleSetCustomWindingness = useCallback((newWindingness) => {
    if (!["low", "normal", "high"].includes(newWindingness)) return;
    setCustomWindingnessState(newWindingness);
    persistPreferences({ theme, routeType, customHilliness, customWindingness: newWindingness, avoidOptions });
  }, [theme, routeType, customHilliness, avoidOptions, persistPreferences]);

  const restorePreferences = useCallback((saved = {}) => {
    const nextTheme = THEME_CONFIGS[saved.theme] ? saved.theme : theme;
    const allowedRouteTypes = THEME_CONFIGS[nextTheme]?.routeTypes.map(option => option.id) || [];
    const nextRouteType = allowedRouteTypes.includes(saved.routeType) ? saved.routeType : routeType;
    const nextTravelMode = ["car", "motorcycle", "bike", "pedestrian"].includes(saved.travelMode)
      ? saved.travelMode
      : (THEME_CONFIGS[nextTheme]?.travelMode || travelMode);
    const nextCustomHilliness = ["low", "normal", "high"].includes(saved.customHilliness)
      ? saved.customHilliness
      : customHilliness;
    const nextCustomWindingness = ["low", "normal", "high"].includes(saved.customWindingness)
      ? saved.customWindingness
      : customWindingness;
    const nextAvoidOptions = Object.fromEntries(AVOID_KEYS.map(key => [
      key,
      typeof saved.avoidOptions?.[key] === "boolean" ? saved.avoidOptions[key] : avoidOptions[key],
    ]));

    setThemeState(nextTheme);
    setRouteTypeState(nextRouteType);
    setTravelModeState(nextTravelMode);
    setCustomHillinessState(nextCustomHilliness);
    setCustomWindingnessState(nextCustomWindingness);
    setAvoidOptionsState(nextAvoidOptions);
    setAvoidMotorwaysState(nextAvoidOptions.motorways);
    const restored = {
      theme: nextTheme,
      routeType: nextRouteType,
      travelMode: nextTravelMode,
      customHilliness: nextCustomHilliness,
      customWindingness: nextCustomWindingness,
      avoidOptions: nextAvoidOptions,
    };
    persistPreferences(restored);
    return restored;
  }, [theme, routeType, travelMode, customHilliness, customWindingness, avoidOptions, persistPreferences]);

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultsForBrand();
    setThemeState(theme);
    setRouteTypeState(defaults.routeType);
    setTravelModeState(defaults.travelMode);
    setAvoidMotorwaysState(false);
    setCustomHillinessState("normal");
    setCustomWindingnessState("normal");
    setAvoidOptionsState(DEFAULT_AVOID_OPTIONS);
    persistPreferences({ theme, routeType: defaults.routeType, customHilliness: "normal", customWindingness: "normal", avoidOptions: DEFAULT_AVOID_OPTIONS });
  }, [theme, getDefaultsForBrand, persistPreferences]);

  const value = {
    theme,
    setTheme: handleSetTheme,
    routeType,
    setRouteType: handleSetRouteType,
    avoidMotorways,
    setAvoidMotorways: handleSetAvoidMotorways,
    avoidOptions,
    setAvoidOption: handleSetAvoidOption,
    travelMode,
    customHilliness,
    setCustomHilliness: handleSetCustomHilliness,
    customWindingness,
    setCustomWindingness: handleSetCustomWindingness,
    restorePreferences,
    availableRouteTypes: getAvailableRouteTypes(),
    availableAvoidKeys: THEME_CONFIGS[theme]?.avoidKeys || AVOID_KEYS,
    resetToDefaults,
    getDefaultsForBrand,
    routeTypeMap: ROUTE_TYPE_MAP,
  };

  return (
    <RoutingPreferencesContext.Provider value={value}>
      {children}
    </RoutingPreferencesContext.Provider>
  );
}

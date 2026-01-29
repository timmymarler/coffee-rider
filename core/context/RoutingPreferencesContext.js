import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useEffect, useState } from "react";

export const RoutingPreferencesContext = createContext({
  theme: "rider",
  setTheme: () => {},
  routeType: "fastest",
  setRouteType: () => {},
  travelMode: "car",
  setTravelMode: () => {},
  customHilliness: "normal",
  setCustomHilliness: () => {},
  customWindingness: "normal",
  setCustomWindingness: () => {},
  availableRouteTypes: [],
  resetToDefaults: () => {},
  getDefaultsForBrand: () => {},
});

// Theme-specific routing defaults with available route options per vehicle type
const THEME_CONFIGS = {
  rider: {
    travelMode: "motorcycle",
    defaultRouteType: "curvy",
    routeTypes: [
      { id: "fastest", label: "⚡ Fastest", description: "Minimize travel time" },
      { id: "curvy", label: "🎢 Curvy", description: "Smooth curves, moderate windingness" },
      { id: "twisty", label: "🌀 Twisty", description: "Maximum turns and curves" },
      { id: "adventure", label: "🏔️ Adventure", description: "Hilly mountain roads" },
      { id: "custom", label: "⚙️ Custom", description: "Choose your own windingness & hilliness" },
    ],
  },
  driver: {
    travelMode: "car",
    defaultRouteType: "fastest",
    routeTypes: [
      { id: "fastest", label: "⚡ Fastest", description: "Minimize travel time" },
      { id: "eco", label: "🌱 Eco", description: "Fuel-efficient routes" },
      { id: "shortest", label: "📏 Shortest", description: "Minimize distance" },
    ],
  },
  strider: {
    travelMode: "pedestrian",
    defaultRouteType: "shortest",
    routeTypes: [
      { id: "shortest", label: "📏 Shortest", description: "Minimize distance" },
      { id: "scenic", label: "🎢 Scenic", description: "Interesting pedestrian routes" },
    ],
  },
};

// Map route type IDs to TomTom parameters
// This connects the user-friendly route type to the actual API parameters
// TomTom routeType options: fastest, shortest, short, eco, thrilling
// For thrilling routes, use hilliness and windingness modifiers
const ROUTE_TYPE_MAP = {
  // Motorcycle routes - focus on different aspects of interesting roads
  curvy: { tomtomRouteType: "thrilling", hilliness: "normal", windingness: "low" }, // Smooth curves, moderate turns
  twisty: { tomtomRouteType: "thrilling", hilliness: "normal", windingness: "high" }, // Maximum turns and curves
  adventure: { tomtomRouteType: "thrilling", hilliness: "high", windingness: "low" }, // Hilly mountain roads
  custom: { tomtomRouteType: "thrilling", hilliness: "normal", windingness: "normal" }, // User-defined (defaults provided)
  
  // Car routes
  eco: { tomtomRouteType: "eco", hilliness: null, windingness: null }, // Fuel-efficient routing
  scenic: { tomtomRouteType: "thrilling", hilliness: "high", windingness: "normal" }, // Hilly scenic routes for pedestrians
  
  // Shared/Default routes
  fastest: { tomtomRouteType: "fastest", hilliness: null, windingness: null }, // All roads for speed
  shortest: { tomtomRouteType: "shortest", hilliness: null, windingness: null }, // Minimize distance
};

export function RoutingPreferencesProvider({ children, brand = "rider" }) {
  const [theme, setThemeState] = useState("rider");
  const [routeType, setRouteTypeState] = useState("fastest");
  const [travelMode, setTravelModeState] = useState("car");
  const [customHilliness, setCustomHillinessState] = useState("normal");
  const [customWindingness, setCustomWindingnessState] = useState("normal");
  const [isLoaded, setIsLoaded] = useState(false);

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
        // For now, always use rider theme - ignore stored preferences
        const defaults = getDefaultsForBrand("rider");
        setThemeState("rider");
        setRouteTypeState(defaults.routeType);
        setTravelModeState(defaults.travelMode);
      } catch (error) {
        console.error("[RoutingPreferences] Error loading preferences:", error);
        const defaults = getDefaultsForBrand("rider");
        setThemeState("rider");
        setRouteTypeState(defaults.routeType);
        setTravelModeState(defaults.travelMode);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPreferences();
  }, []);

  // Set theme (vehicle type) - currently locked to "rider" only
  const handleSetTheme = useCallback((newTheme) => {
    // Theme is locked to "rider" for now, ignoring changes
    console.log("[RoutingPreferences] Theme is locked to 'rider'");
  }, []);

  // Set route type (optimization strategy)
  const handleSetRouteType = useCallback((newRouteType) => {
    setRouteTypeState(newRouteType);
    // Always save under "rider" theme
    AsyncStorage.setItem(
      "routingPreferences",
      JSON.stringify({
        theme: "rider",
        routeType: newRouteType,
      })
    ).catch((err) => console.error("[RoutingPreferences] Error saving:", err));
  }, []);

  // Set custom hilliness for thrilling routes
  const handleSetCustomHilliness = useCallback((newHilliness) => {
    setCustomHillinessState(newHilliness);
  }, []);

  // Set custom windingness for thrilling routes
  const handleSetCustomWindingness = useCallback((newWindingness) => {
    setCustomWindingnessState(newWindingness);
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultsForBrand();
    setThemeState(theme);
    setRouteTypeState(defaults.routeType);
    setTravelModeState(defaults.travelMode);
    AsyncStorage.setItem(
      "routingPreferences",
      JSON.stringify({
        theme: theme,
        routeType: defaults.routeType,
      })
    ).catch((err) => console.error("[RoutingPreferences] Error saving:", err));
  }, [theme]);

  const value = {
    theme,
    setTheme: handleSetTheme,
    routeType,
    setRouteType: handleSetRouteType,
    travelMode,
    customHilliness,
    setCustomHilliness: handleSetCustomHilliness,
    customWindingness,
    setCustomWindingness: handleSetCustomWindingness,
    availableRouteTypes: getAvailableRouteTypes(),
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

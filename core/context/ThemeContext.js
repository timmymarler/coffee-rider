// core/context/ThemeContext.js
import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import driver from "@themes/driver";
import rider from "@themes/rider";
import strider from "@themes/strider";

const brands = {
  rider,
  driver,
  strider,
};

const defaultBrand = "rider";

const ThemeContextInternal = createContext({
  brand: defaultBrand,
  theme: rider,
  setBrand: () => {},
});

export function ThemeProvider({ children }) {
  const [brand, setBrandState] = useState(defaultBrand);
  const [theme, setThemeState] = useState(rider);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference from AsyncStorage on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedBrand = await AsyncStorage.getItem("selectedTheme");
      if (savedBrand && brands[savedBrand]) {
        setBrandState(savedBrand);
        setThemeState(brands[savedBrand]);
      }
    } catch (error) {
      console.error("Error loading theme:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setBrand = async (newBrand) => {
    if (brands[newBrand]) {
      setBrandState(newBrand);
      setThemeState(brands[newBrand]);
      try {
        await AsyncStorage.setItem("selectedTheme", newBrand);
      } catch (error) {
        console.error("Error saving theme:", error);
      }
    }
  };

  return (
    <ThemeContextInternal.Provider value={{ brand, theme, setBrand, isLoading }}>
      {children}
    </ThemeContextInternal.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContextInternal);
  return context?.theme || rider;
}

export function useThemeControls() {
  const context = useContext(ThemeContextInternal);
  return {
    brand: context?.brand || defaultBrand,
    theme: context?.theme || rider,
    setBrand: context?.setBrand || (() => {}),
  };
}

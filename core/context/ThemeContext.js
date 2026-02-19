// core/context/ThemeContext.js
import { createContext, useContext, useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
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

export function ThemeProvider({ children, userProfile, userId }) {
  const [brand, setBrandState] = useState(userProfile?.selectedTheme || defaultBrand);
  const [theme, setThemeState] = useState(brands[userProfile?.selectedTheme] || rider);

  // Update theme when user profile changes
  useEffect(() => {
    if (userProfile?.selectedTheme && brands[userProfile.selectedTheme]) {
      setBrandState(userProfile.selectedTheme);
      setThemeState(brands[userProfile.selectedTheme]);
    }
  }, [userProfile?.selectedTheme]);

  const setBrand = async (newBrand) => {
    if (!brands[newBrand]) return;

    // Update local state immediately
    setBrandState(newBrand);
    setThemeState(brands[newBrand]);

    // Save to user profile in Firestore
    if (userId) {
      try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          selectedTheme: newBrand,
          updatedAt: Date.now(),
        });
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    }
  };

  return (
    <ThemeContextInternal.Provider value={{ brand, theme, setBrand }}>
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

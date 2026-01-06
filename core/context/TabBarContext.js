import { createContext, useCallback, useState } from "react";

export const TabBarContext = createContext({
  hidden: false,
  hide: () => {},
  show: () => {},

  // Map action hooks
  mapActions: null,
  setMapActions: () => {},

  // NEW: map remount trigger
  reloadMap: () => {},
  mapReloadKey: 0,
});

export function TabBarProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  const [mapActions, setMapActions] = useState(null);

  // NEW
  const [mapReloadKey, setMapReloadKey] = useState(0);

  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);

  // NEW
  const reloadMap = useCallback(() => {
    setMapReloadKey((k) => k + 1);
  }, []);

  return (
    <TabBarContext.Provider
      value={{
        hidden,
        hide,
        show,
        mapActions,
        setMapActions,

        // NEW
        reloadMap,
        mapReloadKey,
      }}
    >
      {children}
    </TabBarContext.Provider>
  );
}

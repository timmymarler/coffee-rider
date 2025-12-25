import { createContext, useCallback, useState } from "react";

export const TabBarContext = createContext({
  hidden: false,
  hide: () => {},
  show: () => {},

  // NEW
  mapActions: null,
  setMapActions: () => {},
});

export function TabBarProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  const [mapActions, setMapActions] = useState(null);

  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);

  return (
    <TabBarContext.Provider
      value={{
        hidden,
        hide,
        show,
        mapActions,
        setMapActions,
      }}
    >
      {children}
    </TabBarContext.Provider>
  );
}

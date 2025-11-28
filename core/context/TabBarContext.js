import { createContext, useCallback, useState } from "react";

export const TabBarContext = createContext({
  hidden: false,
  hide: () => {},
  show: () => {}
});

export function TabBarProvider({ children }) {
  const [hidden, setHidden] = useState(false);

  // Proper helper methods
  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);

  return (
    <TabBarContext.Provider value={{ hidden, hide, show }}>
      {children}
    </TabBarContext.Provider>
  );
}

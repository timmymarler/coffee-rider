import { createContext, useState } from "react";

export const TabBarContext = createContext({
  hidden: false,
  setHidden: () => {}
});

export function TabBarProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  return (
    <TabBarContext.Provider value={{ hidden, setHidden }}>
      {children}
    </TabBarContext.Provider>
  );
}

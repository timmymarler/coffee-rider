import { createContext, useContext, useMemo } from "react";
import { AuthContext } from "./AuthContext";

export const RoleContext = createContext(null);

export default function RoleProvider({ children }) {
  const { profile } = useContext(AuthContext);
  const role = profile?.role || "guest";
  const subscription = profile?.subscriptionStatus || "free";

  const isPro = role === "pro" || subscription === "pro" || role === "admin";

  const can = useMemo(() => ({
    viewPlace: true,
    addComment: role !== "guest",
    ratePlace: role !== "guest",
    favourite: role !== "guest",
    createCustomPlace: isPro,
    saveRoute: isPro,
    multiStopRouting: isPro,
    startGroupRide: isPro,
    joinGroupRide: role !== "guest",
    moderate: role === "admin",
  }), [role, subscription]);

  return (
    <RoleContext.Provider value={{ role, subscription, can }}>
      {children}
    </RoleContext.Provider>
  );
}

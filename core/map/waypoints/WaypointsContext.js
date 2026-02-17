import { createContext, useContext, useState } from "react";

export const WaypointsContext = createContext(null);

export function WaypointsProvider({ children }) {
  const [waypoints, setWaypoints] = useState([]);
  const [pendingSavedRouteId, setPendingSavedRouteId] = useState(null);
  const [enableFollowMeAfterLoad, setEnableFollowMeAfterLoad] = useState(false);

  function addWaypoint(waypoint) {
    setWaypoints(prev => [...prev, waypoint]);
  }

  function addWaypointAtStart(waypoint) {
    setWaypoints(prev => {
      const newWaypoints = [waypoint, ...prev];
      return newWaypoints;
    });
  }

  function insertWaypoint(waypoint, index) {
    setWaypoints(prev => {
      const newWaypoints = [...prev];
      newWaypoints.splice(index, 0, waypoint);
      return newWaypoints;
    });
  }

  function removeWaypoint(index) {
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  }

  function reorderWaypoints(fromIndex, toIndex) {
    setWaypoints(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }

  function clearWaypoints() {
    setWaypoints([]);
  }

  return (
    <WaypointsContext.Provider
      value={{
        waypoints,
        addWaypoint,
        addWaypointAtStart,
        insertWaypoint,
        removeWaypoint,
        reorderWaypoints,
        clearWaypoints,
        pendingSavedRouteId,
        setPendingSavedRouteId,
        enableFollowMeAfterLoad,
        setEnableFollowMeAfterLoad,
      }}
    >
      {children}
    </WaypointsContext.Provider>
  );
}

export function useWaypointsContext() {
  const ctx = useContext(WaypointsContext);
  if (!ctx) {
    throw new Error("useWaypointsContext must be used within WaypointsProvider");
  }
  return ctx;
}

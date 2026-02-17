import { createContext, useContext, useState } from "react";

export const WaypointsContext = createContext(null);

export function WaypointsProvider({ children }) {
  const [waypoints, setWaypoints] = useState([]);
  const [pendingSavedRouteId, setPendingSavedRouteId] = useState(null);
  const [enableFollowMeAfterLoad, setEnableFollowMeAfterLoad] = useState(false);

  function addWaypoint(waypoint) {
    console.log("[WaypointsContext] addWaypoint called with:", waypoint);
    setWaypoints(prev => {
      const newWaypoints = [...prev, waypoint];
      console.log("[WaypointsContext] addWaypoint completed. New count:", newWaypoints.length);
      return newWaypoints;
    });
  }

  function addWaypointAtStart(waypoint) {
    console.log("[WaypointsContext] addWaypointAtStart called with:", waypoint);
    setWaypoints(prev => {
      const newWaypoints = [waypoint, ...prev];
      console.log("[WaypointsContext] Waypoints updated. New count:", newWaypoints.length);
      return newWaypoints;
    });
  }

  function insertWaypoint(waypoint, index) {
    console.log("[WaypointsContext] insertWaypoint called at index:", index);
    setWaypoints(prev => {
      const newWaypoints = [...prev];
      newWaypoints.splice(index, 0, waypoint);
      console.log("[WaypointsContext] Waypoint inserted at index", index, ". New count:", newWaypoints.length);
      return newWaypoints;
    });
  }

  function removeWaypoint(index) {
    console.log("[WaypointsContext] removeWaypoint called at index:", index);
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  }

  function reorderWaypoints(fromIndex, toIndex) {
    console.log("[WaypointsContext] reorderWaypoints called from", fromIndex, "to", toIndex);
    setWaypoints(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }

  function clearWaypoints() {
    console.log("[WaypointsContext] clearWaypoints called");
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

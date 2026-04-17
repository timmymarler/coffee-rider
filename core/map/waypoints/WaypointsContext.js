import { createContext, useContext, useState } from "react";

export const WaypointsContext = createContext(null);

let waypointIdCounter = 0;

function ensureWaypointId(waypoint) {
  if (!waypoint) return waypoint;
  if (waypoint._wpId) return waypoint;

  waypointIdCounter += 1;
  return {
    ...waypoint,
    _wpId: `wp-${Date.now()}-${waypointIdCounter}`,
  };
}

function remapVisitedIndicesAfterRemoval(prevVisited, removedIndex) {
  return prevVisited
    .filter((index) => index !== removedIndex)
    .map((index) => (index > removedIndex ? index - 1 : index));
}

function remapVisitedIndicesAfterReorder(prevVisited, fromIndex, toIndex) {
  if (fromIndex === toIndex) return prevVisited;

  return [...prevVisited]
    .map((index) => {
      if (index === fromIndex) return toIndex;

      if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
        return index - 1;
      }

      if (toIndex < fromIndex && index >= toIndex && index < fromIndex) {
        return index + 1;
      }

      return index;
    })
    .sort((a, b) => a - b);
}

export function WaypointsProvider({ children }) {
  const [waypoints, setWaypoints] = useState([]);
  const [visitedWaypointIndices, setVisitedWaypointIndices] = useState([]); // Track which waypoints we've reached
  const [pendingSavedRouteId, setPendingSavedRouteId] = useState(null);
  const [enableFollowMeAfterLoad, setEnableFollowMeAfterLoad] = useState(false);

  function addWaypoint(waypoint) {
    setWaypoints((prev) => [...prev, ensureWaypointId(waypoint)]);
  }

  function addWaypointAtStart(waypoint) {
    setWaypoints((prev) => {
      const newWaypoints = [ensureWaypointId(waypoint), ...prev.map(ensureWaypointId)];
      return newWaypoints;
    });
    setVisitedWaypointIndices((prev) => prev.map((index) => index + 1));
  }

  function insertWaypoint(waypoint, index) {
    setWaypoints((prev) => {
      const newWaypoints = prev.map(ensureWaypointId);
      newWaypoints.splice(index, 0, ensureWaypointId(waypoint));
      return newWaypoints;
    });
    setVisitedWaypointIndices((prev) => prev.map((visitedIndex) => (visitedIndex >= index ? visitedIndex + 1 : visitedIndex)));
  }

  function removeWaypoint(index) {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
    setVisitedWaypointIndices((prev) => remapVisitedIndicesAfterRemoval(prev, index));
  }

  function reorderWaypoints(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    setWaypoints((prev) => {
      const copy = prev.map(ensureWaypointId);
      const [moved] = copy.splice(fromIndex, 1);
      if (!moved) return copy;
      copy.splice(toIndex, 0, moved);
      return copy;
    });
    setVisitedWaypointIndices((prev) => remapVisitedIndicesAfterReorder(prev, fromIndex, toIndex));
  }

  function clearWaypoints() {
    setWaypoints([]);
    setVisitedWaypointIndices([]); // Clear visited tracking too
  }

  function markWaypointVisited(index) {
    setVisitedWaypointIndices(prev => {
      if (prev.includes(index)) return prev; // Already marked
      return [...prev, index];
    });
  }

  function getNextUnvisitedWaypointIndex() {
    // Find the first waypoint that hasn't been visited yet
    for (let i = 0; i < waypoints.length; i++) {
      if (!visitedWaypointIndices.includes(i)) {
        return i;
      }
    }
    return -1; // All waypoints visited
  }

  return (
    <WaypointsContext.Provider
      value={{
        waypoints,
        visitedWaypointIndices,
        addWaypoint,
        addWaypointAtStart,
        insertWaypoint,
        removeWaypoint,
        reorderWaypoints,
        clearWaypoints,
        markWaypointVisited,
        getNextUnvisitedWaypointIndex,
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

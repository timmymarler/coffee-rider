import { useWaypointsContext } from "./WaypointsContext";

export default function useWaypoints() {
  const {
    waypoints,
    addWaypoint,
    removeWaypoint,
    clearWaypoints,
    reorderWaypoints,
  } = useWaypointsContext();

  function addFromPlace(place) {
    if (!place?.latitude || !place?.longitude) return;

    addWaypoint({
      lat: place.latitude,
      lng: place.longitude,
      title: place.title || "Unnamed place",
      source: place.source || "unknown",
    });
  }

  function addFromMapPress(coordinate) {
    if (!coordinate?.latitude || !coordinate?.longitude) return;

    addWaypoint({
      lat: coordinate.latitude,
      lng: coordinate.longitude,
      title: "Dropped pin",
      source: "manual",
    });
  }

  return {
    waypoints,
    addFromPlace,
    addFromMapPress,
    removeWaypoint,
    reorderWaypoints,
    clearWaypoints,
  };
}

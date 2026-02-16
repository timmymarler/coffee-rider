import { useWaypointsContext } from "./WaypointsContext";

export default function useWaypoints() {
  const {
    waypoints,
    addWaypoint,
    removeWaypoint,
    clearWaypoints,
    reorderWaypoints,
  } = useWaypointsContext();

  function deriveWaypointTitle(label) {
    if (typeof label === "string" && label.trim().length > 0) {
      return label;
    }
    return "Dropped pin";
  }

  function addFromPlace(place) {
    if (!place?.latitude || !place?.longitude) return;

    addWaypoint({
      lat: place.latitude,
      lng: place.longitude,
      title: place.title || "Unnamed place",
      source: place.source || "unknown",
    });
  }

  function addFromMapPress({ latitude, longitude, geocodeResult, isStartPoint = false }) {
    addWaypoint({
      lat: latitude,
      lng: longitude,
      title: deriveWaypointTitle(geocodeResult),
      source: "manual",
      isStartPoint, // Mark whether this was explicitly set as a start point
    });
  }

  function formatPoint({ latitude, longitude, geocodeResult }) {
    return {
      lat: latitude,
      lng: longitude,
      title: deriveWaypointTitle(geocodeResult),
      source: "manual",
    };
  }

  return {
    waypoints,
    addFromPlace,
    addFromMapPress,
    formatPoint,
    removeWaypoint,
    reorderWaypoints,
    clearWaypoints,
  };
}

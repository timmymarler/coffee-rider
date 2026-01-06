export function loadRoute({
  route,
  setRouteDestination,
  setWaypoints,
  clearRoute,
}) {
  clearRoute();

  setRouteDestination({
    latitude: route.destination.lat,
    longitude: route.destination.lng,
    title: route.destination.title,
    id: route.destination.placeId,
  });

  setWaypoints(
    route.waypoints.map(wp => ({
      lat: wp.lat,
      lng: wp.lng,
      title: wp.title,
      source: wp.source,
    }))
  );
}

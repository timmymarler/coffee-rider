import Supercluster from 'supercluster';

export function createPlaceClusterIndex(places) {
  const index = new Supercluster({ radius: 32, maxZoom: 9, minPoints: 2 });
  const routeStops = [];
  const features = [];
  places.forEach(place => {
    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
    if (place.id.startsWith('route-destination-') || place.id.startsWith('route-waypoint-')) {
      routeStops.push(place);
      return;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
      properties: { place },
    });
  });
  index.load(features);
  return { index, routeStops };
}

export function getPlaceClusters({ index, routeStops }, camera) {
  const zoom = Math.max(0, Math.min(20, Math.floor(camera?.zoom ?? 12)));
  const bounds = camera?.bounds || [-180, -85.051129, 180, 85.051129];
  const markers = index.getClusters(bounds, zoom).map(feature => {
    if (!feature.properties.cluster) return feature.properties.place;
    const [longitude, latitude] = feature.geometry.coordinates;
    const clusterId = feature.properties.cluster_id;
    return {
      id: `cluster-${clusterId}`,
      title: `${feature.properties.point_count} places`,
      latitude,
      longitude,
      clusterCount: feature.properties.point_count,
      expansionZoom: index.getClusterExpansionZoom(clusterId),
      iconGlyph: 0,
      iconColor: '#FFFFFF',
      fillColor: '#1678B8',
      circleColor: '#1678B8',
      strokeColor: '#FFFFFF',
    };
  });
  return [...markers, ...routeStops];
}
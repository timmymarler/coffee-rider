import { Platform, requireNativeComponent } from 'react-native';
import { createElement, useMemo, useState } from 'react';
import { createPlaceClusterIndex, getPlaceClusters } from './tomtomPlaceClusters';

const NativeTomTomMap = Platform.OS === 'android'
  ? requireNativeComponent('CoffeeRiderTomTomMapView')
  : null;

export default function TomTomEmbeddedMap({ places = [], onCameraChange, ...props }) {
  const [camera, setCamera] = useState(null);
  const clusterIndex = useMemo(() => createPlaceClusterIndex(places), [places]);
  const clusteredPlaces = useMemo(() => camera
    ? getPlaceClusters(clusterIndex, camera)
    : clusterIndex.routeStops, [clusterIndex, camera]);
  if (!NativeTomTomMap) return null;
  return createElement(NativeTomTomMap, {
    ...props,
    places: clusteredPlaces,
    onCameraChange: event => {
      const state = event.nativeEvent;
      if (Number.isFinite(state?.zoom)) {
        setCamera({
          zoom: state.zoom,
          bounds: [state.west, state.south, state.east, state.north].every(Number.isFinite)
            ? [state.west, state.south, state.east, state.north]
            : null,
        });
      }
      onCameraChange?.(event);
    },
  });
}
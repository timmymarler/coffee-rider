import React from 'react';
import { NativeModules, Text, View } from 'react-native';

let MapViewImpl = null;
let MarkerImpl = null;
let PolylineImpl = null;

let MAPS_MODULE_AVAILABLE = true;
let MAPS_MODULE_LOAD_ERROR = null;

function hasNativeMapsModule() {
  const native = NativeModules || {};
  return Boolean(
    native.RNMapsAirModule ||
    native.AIRMapManager ||
    native.AIRMapModule ||
    native.AirMapModule
  );
}

try {
  if (!hasNativeMapsModule()) {
    throw new Error('react-native-maps native module is not present in this app binary.');
  }

  const mapsModule = require('react-native-maps');
  MapViewImpl = mapsModule.default || mapsModule;
  MarkerImpl = mapsModule.Marker || null;
  PolylineImpl = mapsModule.Polyline || null;

  if (!MapViewImpl || !MarkerImpl || !PolylineImpl) {
    throw new Error('react-native-maps exports are incomplete in this build.');
  }
} catch (error) {
  MAPS_MODULE_AVAILABLE = false;
  MAPS_MODULE_LOAD_ERROR = error;
}

function MissingMapView({ style }) {
  return (
    <View style={[{ backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ color: '#f8fafc', textAlign: 'center', paddingHorizontal: 20 }}>
        Map module is not available in this iOS build. Rebuild the app binary and reopen.
      </Text>
    </View>
  );
}

function NullOverlay() {
  return null;
}

const MapView = MapViewImpl || MissingMapView;
const Marker = MarkerImpl || NullOverlay;
const Polyline = PolylineImpl || NullOverlay;

export { MAPS_MODULE_AVAILABLE, MAPS_MODULE_LOAD_ERROR, MapView, Marker, Polyline };
export default MapView;

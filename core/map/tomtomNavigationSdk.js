import { NativeModules, Platform } from 'react-native';

const nativeModule = Platform.OS === 'android' ? NativeModules.TomTomNavigation : null;

const unavailableStatus = {
  available: false,
  configured: false,
  initialized: false,
  platform: Platform.OS,
  sdkVersion: null,
};

export async function getTomTomNavigationStatus() {
  if (!nativeModule) return unavailableStatus;
  return nativeModule.getStatus();
}

export async function initializeTomTomNavigation({ telemetryEnabled }) {
  if (!nativeModule) {
    throw new Error(`TomTom Navigation SDK is not available on ${Platform.OS}`);
  }
  if (typeof telemetryEnabled !== 'boolean') {
    throw new TypeError('telemetryEnabled must reflect an explicit user consent choice');
  }
  return nativeModule.initialize(telemetryEnabled);
}

export async function openTomTomMapDemo(coffeeShops = []) {
  if (!nativeModule) {
    throw new Error(`TomTom Navigation SDK is not available on ${Platform.OS}`);
  }
  return nativeModule.openMapDemo(JSON.stringify(coffeeShops));
}
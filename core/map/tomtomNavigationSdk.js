import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const nativeModule = Platform.OS === 'android' ? NativeModules.TomTomNavigation : null;

export async function isTomTomTesterBuild() {
  return nativeModule ? nativeModule.isTesterBuild() : false;
}

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

export async function planTomTomRoute({
  origin,
  destination,
  waypoints = [],
  travelMode = 'car',
  routeType = 'fastest',
  routeTypeMap = null,
  customHilliness = null,
  customWindingness = null,
  avoidMotorways = false,
  avoidOptions = null,
  includeAlternatives = true,
}) {
  if (!nativeModule) {
    throw new Error(`TomTom Navigation SDK routing is not available on ${Platform.OS}`);
  }

  await initializeTomTomNavigation({ telemetryEnabled: false });
  const planForType = (type) => {
    const routePreferences = routeTypeMap?.[type] || {};
    const useCustomPreferences = type === 'curvy' || type === 'custom';
    const hilliness = useCustomPreferences
      ? customHilliness || routePreferences.hilliness || 'normal'
      : routePreferences.hilliness || customHilliness || 'normal';
    const windingness = useCustomPreferences
      ? customWindingness || routePreferences.windingness || 'normal'
      : routePreferences.windingness || customWindingness || 'normal';

    return nativeModule.planRoute(
      origin,
      destination,
      waypoints,
      travelMode,
      routePreferences.tomtomRouteType || type,
      hilliness,
      windingness,
      Object.entries({ ...(avoidOptions || {}), motorways: avoidOptions?.motorways ?? avoidMotorways })
        .filter(([, enabled]) => enabled)
        .map(([key]) => key),
    );
  };

  const primary = await planForType(routeType);
  if (!includeAlternatives) return { ...primary, alternatives: [] };
  const alternatives = uniqueRoutes(primary, primary.alternatives || []);
  if (alternatives.length) {
    return { ...primary, alternatives };
  }

  const fallbackTypes = routeAlternativesFor(routeType);
  const fallbackResults = await Promise.all(fallbackTypes.map(async (type) => {
    try {
      const route = await planForType(type);
      return { ...route, label: routeTypeLabel(type) };
    } catch (error) {
      console.warn(`[TomTomRouting] ${type} alternative unavailable:`, error?.message || error);
      return null;
    }
  }));

  return {
    ...primary,
    label: routeTypeLabel(routeType),
    alternatives: uniqueRoutes(primary, fallbackResults.filter(Boolean)),
  };
}

function routeAlternativesFor(routeType) {
  const alternatives = {
    fastest: ['curvy', 'twisty'],
    curvy: ['fastest', 'twisty'],
    twisty: ['fastest', 'curvy'],
    adventure: ['fastest', 'curvy'],
    custom: ['fastest', 'twisty'],
  };
  return alternatives[routeType] || ['fastest', 'curvy'];
}

function routeTypeLabel(routeType) {
  const labels = {
    fastest: 'Fastest',
    curvy: 'Curvy',
    twisty: 'Twisty',
    adventure: 'Adventure',
    custom: 'Custom',
  };
  return labels[routeType] || 'Alternative';
}

function uniqueRoutes(primary, alternatives) {
  const seen = new Set([primary.routeFingerprint].filter(Boolean));
  return alternatives.filter((route) => {
    if (!route?.nativeRouteId) return false;
    const fingerprint = route.routeFingerprint;
    if (fingerprint && seen.has(fingerprint)) return false;
    if (fingerprint) seen.add(fingerprint);
    return true;
  });
}

export async function openTomTomMapDemo(coffeeShops = []) {
  if (!nativeModule) {
    throw new Error(`TomTom Navigation SDK is not available on ${Platform.OS}`);
  }
  return nativeModule.openMapDemo(JSON.stringify(coffeeShops));
}

export async function hasNativeTomTomRoute(routeId) {
  if (!routeId || !nativeModule?.hasPlannedRoute) return false;
  return nativeModule.hasPlannedRoute(routeId);
}

export async function getNativeTomTomRoute(routeId) {
  if (!routeId || !nativeModule?.getPlannedRoute) {
    throw new Error('This route choice is no longer available; rebuild the route');
  }
  return nativeModule.getPlannedRoute(routeId);
}

export async function startTomTomNavigation(routeId, { simulate = false } = {}) {
  if (!nativeModule?.startNavigation) {
    throw new Error('This Android POC needs rebuilding to enable SDK navigation');
  }
  if (!routeId) throw new Error('Plan a route before starting SDK navigation');
  return nativeModule.startNavigation(routeId, simulate);
}

export async function stopTomTomNavigation() {
  if (!nativeModule?.stopNavigation) return;
  return nativeModule.stopNavigation();
}

export async function setTomTomVoiceEnabled(enabled) {
  try {
    if (!nativeModule?.setVoiceEnabled) return;
    await nativeModule.setVoiceEnabled(Boolean(enabled));
  } catch (error) {
    console.warn("[TomTomNavigation] Voice toggle failed:", error?.message || error);
  }
}

export async function simulateTomTomDetour() {
  if (!nativeModule?.simulateOffRoute) throw new Error('Rebuild the Android POC to enable detour simulation');
  return nativeModule.simulateOffRoute();
}

export function subscribeTomTomNavigation(listener) {
  if (!nativeModule?.startNavigation) return { remove() {} };
  return new NativeEventEmitter(nativeModule).addListener('TomTomNavigationEvent', listener);
}
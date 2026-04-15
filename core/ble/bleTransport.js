/**
 * BLE Central transport for CR-Directions
 *
 * Manages the full lifecycle: scan → connect → discover → write.
 * Automatically reconnects if the device disconnects.
 *
 * Usage:
 *   import { initBleTransport, destroyBleTransport } from '@core/ble/bleTransport';
 *   initBleTransport();   // call once on app start (when BLE feature is enabled)
 *   destroyBleTransport(); // call on logout / feature disabled
 *
 * The module registers itself as the globalThis.__CR_BLE_DIRECTIONS_SEND__ transport
 * so directionsTransmitter.js picks it up automatically.
 */

import { BleManager, State } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { getBleDirectionsConfig } from './directionsTransmitter';

const TAG = '[BLE_TRANSPORT]';

// Singleton manager — only one per app lifetime.
let manager = null;
let activeDevice = null;
let activeCharacteristic = null;
let isScanning = false;
let isDestroyed = false;
let reconnectTimer = null;
let stateSubscription = null;

const RECONNECT_DELAY_MS = 4000;
const SCAN_TIMEOUT_MS = 15000;

function log(...args) {
  console.log(TAG, ...args);
}

function warn(...args) {
  console.warn(TAG, ...args);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initBleTransport() {
  if (manager) return; // Already running.

  isDestroyed = false;
  manager = new BleManager();

  // Register transport so directionsTransmitter picks it up.
  globalThis.__CR_BLE_DIRECTIONS_SEND__ = sendPayload;

  // Wait for BLE to be powered on before scanning.
  stateSubscription = manager.onStateChange((state) => {
    if (state === State.PoweredOn) {
      log('BLE powered on — starting scan');
      startScan();
    } else if (state === State.PoweredOff || state === State.Unsupported) {
      warn(`BLE state: ${state} — cannot scan`);
      stopEverything();
    }
  }, true); // true = emit current state immediately
}

export function destroyBleTransport() {
  isDestroyed = true;
  stopEverything();
  if (manager) {
    manager.destroy();
    manager = null;
  }
  if (globalThis.__CR_BLE_DIRECTIONS_SEND__ === sendPayload) {
    delete globalThis.__CR_BLE_DIRECTIONS_SEND__;
  }
  log('Destroyed');
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function stopEverything() {
  clearReconnectTimer();
  if (isScanning && manager) {
    manager.stopDeviceScan();
    isScanning = false;
  }
  activeCharacteristic = null;
  activeDevice = null;
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (isDestroyed) return;
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    if (!isDestroyed && !activeDevice) {
      log('Reconnect attempt...');
      startScan();
    }
  }, RECONNECT_DELAY_MS);
}

function startScan() {
  if (!manager || isDestroyed || isScanning || activeDevice) return;

  const { deviceName, serviceUuid } = getBleDirectionsConfig();
  log(`Scanning for "${deviceName}"...`);

  isScanning = true;

  // Auto-stop scan after timeout to save battery.
  const scanTimeout = setTimeout(() => {
    if (isScanning && manager) {
      manager.stopDeviceScan();
      isScanning = false;
      if (!activeDevice) {
        log('Scan timed out — will retry');
        scheduleReconnect();
      }
    }
  }, SCAN_TIMEOUT_MS);

  manager.startDeviceScan(
    [serviceUuid],   // Filter by service UUID — only wake up for our device.
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        warn('Scan error:', error.message);
        clearTimeout(scanTimeout);
        isScanning = false;
        scheduleReconnect();
        return;
      }

      if (device && (device.localName === deviceName || device.name === deviceName)) {
        log(`Found "${device.name || device.localName}" (${device.id})`);
        clearTimeout(scanTimeout);
        manager.stopDeviceScan();
        isScanning = false;
        connectToDevice(device.id);
      }
    }
  );
}

async function connectToDevice(deviceId) {
  if (!manager || isDestroyed) return;

  try {
    log(`Connecting to ${deviceId}...`);
    const device = await manager.connectToDevice(deviceId, {
      requestMTU: 247,
      autoConnect: false,
    });

    log('Connected — discovering services...');
    await device.discoverAllServicesAndCharacteristics();

    const { serviceUuid, characteristicUuid } = getBleDirectionsConfig();
    const characteristics = await device.characteristicsForService(serviceUuid);
    const target = characteristics.find(c => c.uuid.toLowerCase() === characteristicUuid.toLowerCase());

    if (!target) {
      warn(`Characteristic ${characteristicUuid} not found — disconnecting`);
      await device.cancelConnection();
      scheduleReconnect();
      return;
    }

    activeDevice = device;
    activeCharacteristic = target;
    log('Ready — characteristic discovered');

    // Watch for disconnection.
    device.onDisconnected((error, disconnectedDevice) => {
      log(`Disconnected from ${disconnectedDevice?.id || deviceId}${error ? ` — ${error.message}` : ''}`);
      activeDevice = null;
      activeCharacteristic = null;
      if (!isDestroyed) {
        scheduleReconnect();
      }
    });

  } catch (error) {
    warn('Connection error:', error.message);
    activeDevice = null;
    activeCharacteristic = null;
    scheduleReconnect();
  }
}

async function sendPayload(payload) {
  if (!activeCharacteristic || !activeDevice) {
    // Not connected — silently drop. The scan/reconnect loop will restore connection.
    return;
  }

  try {
    // BLE writes require base64 encoding.
    const encoded = Platform.OS === 'web'
      ? btoa(payload)
      : Buffer.from(payload, 'utf8').toString('base64');

    // WRITE_NR (write without response) is faster and sufficient here.
    await activeCharacteristic.writeWithoutResponse(encoded);
  } catch (error) {
    warn('Write error:', error.message);
    // If the write fails the device likely disconnected — clean up and reconnect.
    activeDevice = null;
    activeCharacteristic = null;
    scheduleReconnect();
  }
}

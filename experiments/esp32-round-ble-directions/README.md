# ESP32 Round Display BLE Directions Prototype

A tiny Arduino prototype that shows a simplified Coffee Rider directions modal on a 1.28" round TFT over BLE.

## What It Does

- Exposes a BLE peripheral named `CR-Directions`
- Accepts direction updates over one writable characteristic
- Renders:
  - maneuver icon
  - distance string
  - instruction text (wrapped)

## Arduino Sketch

- [esp32_round_ble_directions.ino](esp32_round_ble_directions.ino)

## Required Arduino Libraries

- `NimBLE-Arduino` by h2zero
- `TFT_eSPI` by Bodmer

## Display Notes

This sketch assumes your round display is already configured in `TFT_eSPI` (`User_Setup.h` or setup select file).

If your screen is upside down, change:

- `tft.setRotation(0);` in setup

Try values `1`, `2`, `3` as needed.

## BLE Service/Characteristic

- Service UUID: `12345678-1234-1234-1234-1234567890ab`
- Characteristic UUID: `12345678-1234-1234-1234-1234567890ac`
- Properties: `READ`, `WRITE`, `WRITE_NO_RESPONSE`

## Payload Format

Send UTF-8 text in this format:

`MANEUVER|DISTANCE|INSTRUCTION`

Examples:

- `LEFT|0.4 mi|Turn left onto Main St`
- `STRAIGHT|900 ft|Continue for 900 feet`
- `ROUNDABOUT|300 ft|At the roundabout, take the 2nd exit`
- `ARRIVE|Now|You have reached your destination`

Supported maneuvers:

- `LEFT`
- `RIGHT`
- `STRAIGHT`
- `UTURN`
- `ROUNDABOUT`
- `ARRIVE`

Unknown maneuver values fall back to straight arrow.

## Quick Test (No App Code Yet)

1. Flash sketch to ESP32.
2. Open nRF Connect on phone.
3. Connect to `CR-Directions`.
4. Find service `...90ab` and characteristic `...90ac`.
5. Write payload text like:
   - `RIGHT|0.2 mi|Turn right onto Oak Lane`

## Optional RN Integration Path (Later)

When you are ready, add a BLE client in the app and send payload updates whenever the displayed navigation instruction changes.

A small mapper can produce strings from your current step data, for example:

- `maneuver` from `nextManeuver`
- `distance` from your formatted distance text
- `instruction` from your existing normalized instruction text

Keep updates rate-limited (for example, only when text actually changes) to avoid BLE spam.

## App Wiring Added (Feature-Flagged)

This repo now includes a safe, default-off sender module:

- [core/ble/directionsTransmitter.js](../../core/ble/directionsTransmitter.js)

And Map screen hooks to emit direction payload frames while navigating:

- [core/screens/MapScreenRN-TomTom.js](../../core/screens/MapScreenRN-TomTom.js)

Enable it with env vars before running Expo:

- `EXPO_PUBLIC_BLE_DIRECTIONS_ENABLED=true`
- Optional overrides:
  - `EXPO_PUBLIC_BLE_DIRECTIONS_DEVICE_NAME=CR-Directions`
  - `EXPO_PUBLIC_BLE_DIRECTIONS_SERVICE_UUID=12345678-1234-1234-1234-1234567890ab`
  - `EXPO_PUBLIC_BLE_DIRECTIONS_CHARACTERISTIC_UUID=12345678-1234-1234-1234-1234567890ac`

By default, no BLE library is hard-wired in the app sender to avoid adding production risk.
The sender expects a transport function on `globalThis.__CR_BLE_DIRECTIONS_SEND__`.

Minimal transport shape:

```js
globalThis.__CR_BLE_DIRECTIONS_SEND__ = async (payload, meta) => {
  // payload => "LEFT|0.4 mi|Turn left onto Main St"
  // meta => { serviceUuid, characteristicUuid, deviceName }
  // Write payload to ESP32 characteristic using your BLE client implementation.
};
```

This lets you prototype quickly while keeping BLE stack decisions separate.

# Android TomTom POC Navigation

The debug POC package is `com.timmy.marler.coffeerider.tomtom.poc`. It is separate
from the installed production app. This work does not require a paid EAS build.

## Controls

1. Switch to the TomTom map using the debug provider button.
2. Build a route using the existing place and waypoint controls.
3. Enable Follow Me for live SDK guidance. The Navigate action on the TomTom map
   also plans from the current location and starts in-app guidance.
4. Use **Simulate SDK route** for an explicit simulated traversal. Normal Follow
   Me does not enable simulation.
5. Stop simulation or disable Follow Me to stop the SDK session. Clearing the
   route, switching away from the provider, or unloading the screen also stops it.

SDK progress supplies remaining distance and time. SDK guidance supplies the next
maneuver, distance to that maneuver, and announcements passed to the existing
speech handler. The embedded map follows the SDK location provider. The existing
BLE frame consumes the same guidance data; hardware delivery is not yet validated.

The JavaScript turn-progress, speech scheduling and automatic reroute loop are
disabled during an embedded SDK session to avoid competing navigation engines.
Native route IDs are process-local. An Android route cache entry is reused only
while its native plan is still retained; otherwise a fresh SDK route is planned.

## SDK Off-Route Replanning

Embedded SDK sessions enable TomTom automatic deviation replanning. The SDK owns
deviation detection and the remaining itinerary; the JavaScript reroute loop stays
disabled. Active-route changes update map geometry, route totals, maneuver steps,
and the retained native plan without restarting the navigation session. Guidance
reads the current route instead of the route captured at session start.

SDK waypoint arrivals mark matching app waypoints visited. Automatic replanning
keeps the SDK's remaining route stops and destination. Route-change handling
accepts either ordering of route-added and active-route-changed callbacks.

For a debug-only synthetic detour, start **Simulate SDK route**, then long-press
**Stop SDK simulation**. This offsets a short section of the simulated trace,
then rejoins it. It changes only the simulation provider, not real GPS. Logs show
deviation transitions and SDK active-route replacements. This test does not
replace a live road test or multi-stop deviation validation.

Validated on Pixel 10: the Cable Cafe synthetic detour emitted deviation=true,
an SDK active-route replacement (4,534 m), and deviation=false. The returning trace
triggered another replacement (2,971 m), with continuing SDK progress, maneuver
updates, announcements and updated map geometry. No navigation session restart
occurred between these replacements.

## Local Validation

From the repository root:

```sh
cd android
./gradlew :app:compileDebugKotlin
./gradlew :app:assembleDebug
```

Install only the debug POC APK, not a production release APK.

## Marker Clustering

The embedded TomTom map uses Supercluster on the filtered place list. Nearby
places become count badges at lower zoom levels. Tapping or long-pressing a badge
zooms toward its expansion level. Individual pins retain their category styling
and place actions; route destination and waypoint pins are not clustered.

Only places and clusters in the visible map region are sent to native rendering.
Native marker handles are updated incrementally and pin images are cached, rather
than removing and recreating all pins on every camera update.

Run the focused clustering checks from the repository root:

```sh
node scripts/test-tomtom-place-clusters.mjs
```

Validated on Pixel 10: simulated Cable Cafe route, changing maneuvers and distances,
remaining distance/time, SDK announcement delivery, destination arrival, and manual
stop. The final camera build keeps the navigation marker above the bottom toolbar.

## Remaining Limits

- Live road navigation, background/locked-screen operation, and physical BLE
  delivery need separate testing.
- Planning still uses the SDK's default car profile; motorcycle profile parity is
  not implemented yet.
- Speed limits, roundabout exit details, and multi-stop/live-road reroute validation
  remain follow-up work.
- Google walking/cycling routing and non-Android behavior retain their existing paths.
- Saved geometry without a retained native route must be rebuilt before SDK guidance.
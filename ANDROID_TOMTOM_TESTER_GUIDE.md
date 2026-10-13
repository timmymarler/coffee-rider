# Coffee Rider POC: Android Tester Guide

## Install

- Install the supplied Coffee Rider POC APK and allow installation from your
  browser or file manager when Android asks.
- The package is `com.timmy.marler.coffeerider.tomtom.poc`, separate from Coffee
  Rider production. The apps can remain installed together.
- This standalone build contains its JavaScript. It does not need a computer,
  USB connection or Metro server. Maps, routes and places still need internet.
- The APK is about 387 MB because it includes the native TomTom SDK for multiple
   Android processor types; allow time for the download and installation.
- Allow location access and sign in using your existing Coffee Rider account.
- Supports Android 8.0 or newer on arm64 devices; an x86_64 build is also included.

## Test

1. TomTom starts automatically. The map-provider switch remains available for
   comparison with the original map.
2. Select a place, build a route, add/remove waypoints and compare route choices.
3. Try Fastest, Shortest and Curvy; adjust Twisty/Undulating and Avoid settings.
   Restart the app to check your settings are retained.
4. Test filters, marker taps/long-presses, Current Location and cluster expansion.
5. Enable Follow Me for live navigation. Check voice and panel agree, particularly
   at roundabouts, and check off-route replanning when it is safe to do so.
6. Use Simulate SDK route for stationary tests. Long-press Stop SDK simulation
   during simulation to introduce a synthetic detour. Tap it normally to stop.
7. Try saved-route loading and shared-ride joining. Stopping navigation should
   leave location sharing active until sharing is stopped separately.

## Report

Include the app version, phone model, Android version, route origin/destination,
waypoints, route preferences and whether the problem occurred in simulation or
live navigation. Send a screenshot and what the voice said for instruction bugs.
Only capture screenshots or interact with the phone while safely stopped.

## Limits

- This is an Android POC, not an iOS tester build or production release.
- Do not rely on it as your only navigation aid. Background/locked-screen use,
  poor connectivity, multi-stop rerouting and physical BLE delivery need testing.
- Native planning currently uses the SDK's default car profile, including when
  Motorcycle is selected.
- The POC shares the existing backend. Place edits, comments and shared rides
  are real account actions, not an isolated test database.
- Standalone updates require installing a replacement APK; there is no automatic
  tester update channel in this build.
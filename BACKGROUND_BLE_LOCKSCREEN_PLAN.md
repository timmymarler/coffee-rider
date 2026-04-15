# Background BLE While Screen Is Locked - Deferred Plan

Date: 2026-04-15
Status: Deferred intentionally for release safety
Owner: Coffee Rider app team

## Decision Summary

We are shipping the current BLE pod integration as-is for this release because it is low risk and already validated.

We are deferring "keep BLE navigation updates running when phone screen is locked" to a dedicated follow-up task.

## Why Deferred Now

This is a larger architectural change than the current BLE work and introduces meaningful release risk.

Reasons:
- Requires Android foreground service behavior for reliable background execution.
- Requires background location task handling (headless/task context) instead of only in-screen React state updates.
- Requires permission model expansion and edge-case handling across Android versions.
- Requires additional QA scenarios (screen off, app in background, battery saver, reconnect behavior, long rides).
- Current release plan prioritizes stability of already working BLE directions.

## Current Behavior (Known Good)

What is in scope now:
- BLE directions send from the active map/navigation flow.
- ESP32 pod receives maneuver payloads and updates icon + text.
- Idle/logo screen shown at boot and when Follow Me is off.

Limitation:
- When app execution is throttled/suspended in background/lock conditions, BLE updates may stop.

## Future Implementation Plan

### Goal

Allow rider to:
1. Start route + Follow Me.
2. Lock phone / keep phone off handlebars.
3. Continue receiving route guidance on pod + voice while riding.

### Proposed Technical Approach

Android first (primary target):
- Use `expo-task-manager` + `expo-location` background location updates.
- Start background location updates when Follow Me starts.
- Keep an Android foreground service notification active while navigation is active.
- Continue BLE payload transmission from background-capable logic path.

Key requirements:
- Android manifest permissions:
  - `ACCESS_BACKGROUND_LOCATION`
  - `FOREGROUND_SERVICE`
  - `FOREGROUND_SERVICE_LOCATION`
- Runtime permission flow:
  - Foreground location first, then background location request.
- Robust reconnect logic for BLE in background conditions.

### Suggested Work Breakdown

1. Add background permissions and service config.
2. Add background task module (location task definition + lifecycle).
3. Refactor navigation frame generation into shared pure logic callable from UI and background task.
4. Route BLE transport through that shared logic path.
5. Start/stop background updates with Follow Me state transitions.
6. Add telemetry/logging for scan/connect/write + task start/stop.
7. Add QA checklist and execute field tests.

### Testing Matrix (Minimum)

- Android screen on + app foreground.
- Android screen locked for 5/15/30 minutes.
- Battery saver on/off.
- BLE disconnect/reconnect while locked.
- App swiped from recents (expected behavior documented).
- Follow Me toggled off -> pod returns to idle logo.

## Risks To Manage In Follow-Up

- OS background restrictions differ by device/vendor.
- Foreground notification UX acceptance.
- Increased battery usage from continuous location + BLE.
- Ensuring no regression to current stable in-foreground behavior.

## Acceptance Criteria For Future Story

- With Follow Me enabled, pod continues receiving direction updates for >= 30 minutes with screen locked.
- Voice instructions continue while locked (where platform allows).
- No crash loops, no duplicated notifications, clean start/stop behavior.
- Turning Follow Me off stops background task and shows pod idle logo.

## Release Policy

Current release proceeds without background-lock feature.
Background-lock feature ships only after separate implementation + dedicated QA sign-off.

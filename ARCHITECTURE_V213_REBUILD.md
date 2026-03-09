# CoffeeRider v2.13+ Architecture Rebuild

## Status
**Branch:** `version/2.13-stable`  
**Base Commit:** c931f58 (known good, polylines clear properly)  
**Version:** 2.13.0  
**Objective:** Complete simplification and clarification of navigation logic

---

## Core Principle
**One piece of code for one job.** No overlapping concerns, no duplicate state management.

---

## The Three Core Systems

### 1. Route Data Management
**Responsibility:** Decide if we have a valid route to display  
**Single Source of Truth:** `routeCoords` array

What gets decided:
- Do we have coordinates? (`routeCoords.length > 0`)
- Is the route still valid? (user didn't clear it, request is current, not stale)
- Should we render it? (no overlapping "hide" or "clear" states)

**Simplification Goal:**
- ONE state variable: `routeCoords`
- Optional: `routeVersion` for cache-busting on rebuild
- Remove: `hidePolylines`, `pendingFlushRef`, multiple coordinate arrays
- Principle: Once cleared, array is empty. Period. No temporary hiding states.

---

### 2. Route Building
**Responsibility:** Request and populate `routeCoords`  
**Single Function:** `buildRoute()`

What it does:
- Check if we have valid destination/waypoints
- Call routing API (TomTom)
- Decode polyline into coordinates
- **One:** `setRouteCoords([...newCoordinates])`
- Handle errors cleanly

**Simplification Goal:**
- No rebuilding on every re-render
- No vehicle type change rebuilds mid-route
- Build only when user explicitly requests it (tap destination, tap route type, etc)
- Clear request: `clearRoute()` → `setRouteCoords([])` and stop

---

### 3. Navigation Logic (Follow Me)
**Responsibility:** Detect current step and next junction direction  
**Single Source of Truth:** User location + route coordinates

What gets calculated:
- Current position along route (which segment?)
- Distance to next junction
- Direction of next turn (bearing from current location to next junction)
- Should we advance to next step? (distance threshold: 5m)

**Simplification Goal:**
- Pure function: `(userLocation, routeCoords, currentStepIndex) → { nextStepIndex, direction, distance }`
- Update ONLY when:
  - User location changes significantly (10+ meters)
  - currentStepIndex changes
- No complex state: just indices and computed values
- Mini map gets: userLocation + all riders + routeCoords (no special modal state)

---

## Current Problems (What We're Fixing)

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| Polyline persistence on Android | Multiple render systems trying to hide/show polylines | One source of truth: if empty, don't render |
| Over-frequent route rebuilds | Vehicle type, route type, view changes all trigger rebuilds | Explicit user actions only trigger builds |
| Complex Follow Me state | Too many side effects, duplicate location tracking | Pure function for step detection |
| Mini map modal complexity | Trying to layer modals on MapView | Simple corner view, no modal wrapper |
| Multiple coordinate arrays | Pending routes, traveled routes, all stored separately | One route = `routeCoords`, traveled is separate draw |

---

## Files to Rewrite / Simplify

### Primary Files
- **`core/screens/MapScreenRN-TomTom.js`** (4700 lines)
  - Remove: Vehicle type change handler, complicated useEffect chains
  - Keep: `buildRoute()`, `clearRoute()` (simplified)
  - Extract: Navigation calculation to utility function
  
- **`core/map/components/MiniMap.js`** (currently 200+ lines of complex zoom logic)
  - Simplify: Remove modal wrapping, dynamic zoom calculations
  - Keep: Render riders + user location on map
  - New: Just display, no complex state

### New Utility Functions
- **`core/navigation/calculateNextStep.js`**
  - Input: `userLocation`, `routeCoords`, `currentStepIndex`, `routeSteps`
  - Output: `{ nextStepIndex, direction, distanceToJunction, shouldAdvance }`
  - Pure function, no side effects, fully testable

- **`core/navigation/routeBuilder.js`** (maybe extract from MapScreen)
  - Input: destination, waypoints, vehicle type
  - Output: Promise resolving to coordinate array
  - Handle errors cleanly

### Simplify / Keep As-Is
- Polyline rendering: Keep it simple, just checks `routeCoords.length > 0`
- Auto-reroute: Keep the GPS validation logic (proven working)
- Step detection: Rewrite with the three-mechanism approach but in isolation

---

## Follow Me State Machine (v2.14+)

When this is fully clean, we can add proper state machine:

```
States:
  idle        → No route, not in Follow Me
  routing     → Building route, spinner visible
  navigating  → Have route, Following user, showing directions
  arrived     → User near destination, show "you've arrived"

Transitions driven by:
  - User actions (set destination, start ride, clear route)
  - Location updates (user moved to next step, arrived at destination)
  - Errors (reroute needed, lost GPS, etc)
```

But for v2.13, just focus on: **one piece of code per concern.**

---

## Testing Plan

### Phase 1: Core Functionality (v2.13.0)
- [ ] Route builds correctly and displays
- [ ] Polylines clear immediately when "Clear Route" tapped
- [ ] Mini map shows riders without modal
- [ ] Follow Me works with step detection
- [ ] Auto-reroute GPS validation works

### Phase 2: Refinements
- [ ] Performance: No unnecessary re-renders
- [ ] Consistency: Navigation works same on iOS and Android
- [ ] Edge cases: Network errors, GPS loss, rapid re-routes

### Phase 3: Architecture Rebuild (v2.14)
- [ ] State machine implementation
- [ ] Full test coverage of navigation logic
- [ ] Professional nav app feature parity

---

## Commits on This Branch

Will track architectural changes cleanly:
- Clean polyline logic
- Simplified route building
- Extract navigation calculation
- Mini map redesign
- Update version to 2.13.0

No cherry-picking old broken code. Build clean.


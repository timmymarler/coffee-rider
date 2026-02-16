# Debug Logging for isStartPoint Flag

## What Was Added

Added comprehensive debug logging throughout the routing flow to trace why the `isStartPoint` flag isn't preventing polyline draws for single start points.

### Log Points Added:

1. **Handler Level** (MapScreenRN-TomTom.js:904-913)
   - `[handleAddWaypoint]` - When "Add Waypoint" button is tapped
   - `[handleSetStart]` - When "Add Start Point" button is tapped
   - Shows what `isStartPoint` value is being passed

2. **Context Hook Level** (useWaypoints.js:30-36)
   - `[useWaypoints.addFromMapPress]` - When waypoint is being added to context
   - Shows the complete waypoint object including the `isStartPoint` flag
   - Confirms flag is being stored in context

3. **buildRoute Validation** (MapScreenRN-TomTom.js:2625)
   - `[buildRoute]` - Comprehensive log showing:
     - `firstIsStartPoint` value
     - `waypoints.length`
     - `destination` existence
     - Full `waypoints[0]` object
   - Shows if buildRoute is returning early

4. **Early Return** (MapScreenRN-TomTom.js:2630-2631)
   - `[buildRoute] ❌ RETURNING EARLY` - When route shouldn't be drawn
   - Confirms single start point is blocking routing

5. **Routing Logic** (MapScreenRN-TomTom.js:2651-2665)
   - `[buildRoute] Case: ...` - Shows which routing branch is being taken
   - Helps understand routing logic flow

6. **mapRoute Execution** (MapScreenRN-TomTom.js:2670)
   - `[buildRoute] ✅ mapRoute called successfully` - Confirms if mapRoute is being called

## How to Review Console Output

### Test Case 1: Add Single Start Point (should NOT draw polyline)

1. Tap "Add Start Point" button
2. Tap on a location on map
3. Look for console logs in this order:
   ```
   [handleSetStart] Adding start point with isStartPoint=true
   [useWaypoints.addFromMapPress] Adding waypoint with isStartPoint: true waypointData: {..., isStartPoint: true}
   [buildRoute] firstIsStartPoint: true, waypoints.length: 1, destination: false, waypoints[0]: {..., isStartPoint: true}
   [buildRoute] ❌ RETURNING EARLY - Blocked - Need destination or waypoints to route
   ```
   
   **Expected**: See "RETURNING EARLY" message, NO polyline should appear
   **If broken**: Route is being drawn despite early return

### Test Case 2: Add Start Point, Then Second Waypoint (should draw polyline from start to second waypoint)

1. Tap "Add Start Point", tap location A
2. Tap "Add Waypoint", tap location B
3. Look for console logs:
   ```
   [handleSetStart] Adding start point with isStartPoint=true
   [buildRoute] ❌ RETURNING EARLY (after first point)
   
   [handleAddWaypoint] Adding waypoint with isStartPoint=false
   [buildRoute] firstIsStartPoint: true, waypoints.length: 2, destination: false
   [buildRoute] Case: firstIsStartPoint=true, 2+ waypoints → route from waypoints[0]
   [buildRoute] 🚀 About to call mapRoute with firstIsStartPoint: true
   [buildRoute] ✅ mapRoute called successfully
   ```
   
   **Expected**: Route should draw from location A through location B
   **If broken**: Polyline might not include both points or ignore first point

### Test Case 3: Add Regular Waypoint First (current behavior)

1. Tap "Add Waypoint", tap location
2. Look for logs showing `isStartPoint: false` throughout the flow

## Debugging Steps

**If you see ❌ RETURNING EARLY but polyline still draws:**
- Problem: buildRoute early return is working, but polyline is being drawn elsewhere
- Check: Is there another useEffect or handler drawing polylines?

**If you don't see ❌ RETURNING EARLY:**
- Problem: Flag might be lost or not set correctly
- Check: Look at the `waypoints[0]` object in logs - does it have `isStartPoint: true`?

**If `isStartPoint: false` instead of `true`:**
- Problem: Handler is setting wrong value or flag is being reset
- Check: Verify `handleSetStart` is being called (vs `handleAddWaypoint`)

**If buildRoute shows correct flags but polyline logic seems wrong:**
- Check: Look at "Case:" message - which routing branch is taken?
- Verify the final `origin`, `routeWaypoints`, and `destination` match expectations

## Next Steps After Debugging

Once you identify where the logs stop or show wrong values:
1. Share the relevant console output
2. We can trace the exact function where the issue occurs
3. Fix will be targeted to that specific area

## Console Access

- **Expo**: Use `expo start` and press `j` for Flipper console
- **iOS Simulator**: Open console in Xcode or use React Native Debugger
- **Android**: Use `adb logcat` filtered for "react-native"

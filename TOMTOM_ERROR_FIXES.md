# TomTom API 400 Error - Root Cause Analysis & Fixes

## Issues Found & Fixed

### 1. **Coordinate Format Inconsistency** (Primary Issue)
**Problem:** The application uses different coordinate property names across the codebase:
- Some objects use `{latitude, longitude}` (Google Places, saved routes)
- Some objects use `{lat, lng}` (waypoints, map points)

When these different formats were passed to `fetchTomTomRoute()`, the API received `undefined` values, resulting in malformed URLs and 400 errors.

**Example of the bug:**
```javascript
// routeDestination might have {latitude, longitude}
// waypoints have {lat, lng}
// When converting for TomTom:
intermediates.map(wp => ({
  latitude: wp.lat,      // ✓ Correct
  longitude: wp.lng,     // ✓ Correct
}))

// But finalDestination:
const finalDestination = {
  latitude: destination.latitude,  // ✗ Might be undefined!
  longitude: destination.longitude // ✗ Might be undefined!
}
```

### 2. **Missing Coordinate Validation**
**Problem:** No validation was being performed on coordinates before sending them to TomTom API:
- No check for `undefined` or `NaN` values
- No check for out-of-bounds coordinates (lat > 90, lng > 180)
- No type validation (ensuring values are numbers)

## Solutions Implemented

### 1. **Global Coordinate Normalization Function**
Added `normalizeCoord()` function at the module level:

```javascript
function normalizeCoord(obj) {
  if (!obj) return null;
  
  const lat = obj.latitude ?? obj.lat;
  const lng = obj.longitude ?? obj.lng;
  
  // Type validation
  if (typeof lat !== 'number' || typeof lng !== 'number' || 
      isNaN(lat) || isNaN(lng)) {
    console.warn('[normalizeCoord] Invalid coordinates:', obj);
    return null;
  }
  
  // Range validation
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.warn('[normalizeCoord] Coordinates out of bounds:', { lat, lng });
    return null;
  }
  
  return { latitude: lat, longitude: lng };
}
```

**Benefits:**
- Handles both `{lat, lng}` and `{latitude, longitude}` formats
- Returns `null` for invalid coordinates
- Centralized validation logic

### 2. **Updated `buildRoute()` Function**
Now uses `normalizeCoord()` for all coordinates:

```javascript
async function buildRoute({ destinationOverride = null, requestId } = {}) {
  // ... existing validation ...
  
  let finalDestination = null;
  if (destination) {
    finalDestination = normalizeCoord(destination);
    if (!finalDestination) {
      console.error('[buildRoute] Failed to normalize destination coordinates');
      return;
    }
  } else if (waypoints.length > 0) {
    finalDestination = normalizeCoord(waypoints[waypoints.length - 1]);
    if (!finalDestination) {
      console.error('[buildRoute] Failed to normalize last waypoint');
      return;
    }
  }
  
  // Normalize start location
  const startCoord = normalizeCoord(manualStartPoint || userLocation);
  if (!startCoord) {
    console.error('[buildRoute] Failed to normalize start location');
    return;
  }
  
  // Normalize all intermediates
  const normalizedIntermediates = intermediates
    .map(wp => normalizeCoord(wp))
    .filter(wp => wp !== null);
  
  // All coordinates are now guaranteed to be valid
  const result = await fetchTomTomRoute(
    startCoord,
    finalDestination,
    normalizedIntermediates,
    'bike'
  );
}
```

### 3. **Updated `handleRefreshRouteToNextWaypoint()` Function**
Applied the same coordinate normalization logic to the refresh route function, preventing 400 errors when refreshing routes.

### 4. **Enhanced TomTom API Error Reporting**
Added detailed logging to `tomtomRouting.js`:

```javascript
// Log request details for debugging
console.log('[tomtomRouting] Coordinates:', {
  origin: { latitude: origin.latitude, longitude: origin.longitude },
  destination: { latitude: destination.latitude, longitude: destination.longitude },
  waypointsCount: waypoints?.length || 0
});

// Better error reporting
if (!response.ok) {
  const errorText = await response.text();
  console.error('[tomtomRouting] API error response:', {
    status: response.status,
    statusText: response.statusText,
    body: errorText,
    url: url
  });
}
```

## Testing Recommendations

1. **Test with various route types:**
   - Direct destination (no waypoints)
   - Multiple waypoints
   - Saved route with mixed coordinate formats
   - Home address routing

2. **Test coordinate normalization:**
   - Verify `lat`/`lng` format is handled
   - Verify `latitude`/`longitude` format is handled
   - Verify invalid coordinates are rejected with meaningful errors

3. **Monitor logs for:**
   - Any `[normalizeCoord] Invalid coordinates` warnings
   - Any `[tomtomRouting] API error response` with detailed error info
   - Successful `[tomtomRouting] Coordinates:` logs showing valid data

## Expected Behavior After Fix

✅ TomTom 400 errors should be eliminated
✅ Invalid coordinates will be caught and logged before API call
✅ Better debugging information when issues occur
✅ Graceful fallback when coordinates can't be normalized
✅ Routes build successfully with consistent coordinate formats

## Notes on FloatingTabBar activeRide Log

The log `[FloatingTabBar] activeRide from context: null` is **normal** when:
- User hasn't started an active ride yet
- User is just viewing the map without an active ride session

This is not an error - it's just informational logging showing the current state.

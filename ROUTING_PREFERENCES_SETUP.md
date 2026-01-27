# User Routing Preferences Implementation

## Overview
Users can now customize their routing preferences (travel mode and route type), with sensible defaults based on their transport method.

## What's Implemented

### 1. **RoutingPreferencesContext** (`core/context/RoutingPreferencesContext.js`)
- Manages user routing preferences globally
- Persists preferences to AsyncStorage
- Provides brand-specific defaults
- Automatically loads saved preferences on app startup

### 2. **Brand Defaults**
```javascript
rider: { travelMode: "bike", routeType: "shortest" }
driver: { travelMode: "car", routeType: "fastest" }
strider: { travelMode: "pedestrian", routeType: "shortest" }
motorcycle: { travelMode: "motorcycle", routeType: "thrilling" }
```

### 3. **RoutingPreferencesSection Component** (`core/components/routing/RoutingPreferencesSection.js`)
A reusable UI component for users to:
- Select their transport method (Car, Motorcycle, Bike, Walking)
- Choose route optimization (Fastest, Shortest, Scenic, Eco)
- See current settings
- Reset to brand defaults

### 4. **Integration Points**

**App Layout** (`app/_layout.js`)
- Added RoutingPreferencesProvider wrapper
- Initialized with brand="rider" (can be changed dynamically)

**MapScreenRN** (`core/screens/MapScreenRN-TomTom.js`)
- Uses `userTravelMode` from context instead of hardcoded 'bike'
- Both buildRoute and handleRefreshRouteToNextWaypoint use user preferences
- Routes automatically optimized based on user's choices

**TomTom Routing** (`core/map/utils/tomtomRouting.js`)
- Already supports vehicle-specific routing
- Maps travel modes to appropriate route types and avoid preferences
- Full vehicle specs (travelMode, routeType, avoid) sent to API

## How to Use in Profile Screen

Add the component to the profile screen:

```javascript
import RoutingPreferencesSection from "@core/components/routing/RoutingPreferencesSection";

export default function ProfileScreen() {
  return (
    <View>
      {/* existing profile content */}
      <RoutingPreferencesSection />
    </View>
  );
}
```

## User Flow

1. User opens Profile screen
2. Sees "Route Preferences" section with two configuration options:
   - **Transport Method**: Choose primary vehicle type
   - **Route Optimization**: Choose optimization strategy
3. Selection is immediately saved to device storage
4. Next route built uses the user's selected preferences
5. "Reset to Defaults" button returns to brand defaults

## Example Scenarios

### Cyclist (Rider)
- **Preference**: Bike + Shortest
- **Result**: Routes avoid major highways, prioritize shortest distance

### Motorcyclist
- **Preference**: Motorcycle + Scenic
- **Result**: Routes are scenic, thrilling, prefer less-trafficked roads

### Driver
- **Preference**: Car + Fastest
- **Result**: Routes optimize for travel time, prefer motorways

### Pedestrian
- **Preference**: Walking + Shortest
- **Result**: Routes prioritize footways, shortest walking paths

## Technical Details

### State Persistence
- Preferences saved to AsyncStorage as JSON
- Auto-loads on app startup
- Graceful fallback to brand defaults if storage fails

### Context API
- Lightweight context provider
- Memoized callbacks prevent unnecessary re-renders
- Safe defaults for all values

### Validation
- All travel modes and route types are predefined
- Invalid values fall back to defaults
- No external validation needed

## Future Enhancements

1. **Advanced options**: Add avoid preferences UI (avoid ferries, unpaved roads, etc.)
2. **Preset profiles**: Save multiple routing profiles for different scenarios
3. **Time-based defaults**: Different preferences for commute vs leisure
4. **Analytics**: Track which route types users prefer
5. **AI suggestions**: Recommend route types based on journey patterns

# Group Location Sharing Feature Design

## Overview
Lightweight group meetup feature allowing users to share their location and destination with group members. Users see polylines and real-time locations of all group members sharing location in the same group.

## Key Principles
- **Consent-based**: Users only see others' locations if they've explicitly tapped "Share Location" in that group
- **Single group at a time**: User can only actively share to one group
- **Lightweight**: No full route infrastructure—just destination + polyline + location tracking
- **Auto-save**: No manual save needed—picks destination, polyline auto-computes and saves immediately
- **Auto-update**: Adding/removing waypoints auto-updates the saved polyline in real-time

## User Flows

### Flow 1: First User Shares Location in Group
1. Opens GroupsScreen → selects a group
2. Taps "Share Location" button
3. Redirected to map with `groupId=xyz&mode=shareLocation`
4. Map is empty (no other active shares)
5. User picks destination (search or tap map)
6. System auto-computes polyline via Google Maps API
7. Creates `locationShares/{userId}` doc with groupId
8. Polyline appears on map immediately
9. Mini-map appears showing user heading to destination
10. User can add/remove waypoints—auto-updates saved polyline

### Flow 2: Second User Joins (Same Destination)
1. Taps "Share Location" in same group
2. Map loads with `groupId=xyz`
3. Sees first user's polyline + destination marker
4. Can plot route exactly as any route is plotted:
   - Pick destination (same or different)
   - Add waypoints if needed
5. System auto-computes their polyline
6. Creates their own `locationShares/{userId}` doc
7. Mini-map now shows both users
8. Can continue adding/removing waypoints

### Flow 3: Third User with Different Destination
1. Taps "Share Location" in same group
2. Map shows two polylines (one to destination A, one to destination B)
3. Can pick any destination, add waypoints, create their own polyline
4. Mini-map shows all three users

## Exit/Stopping Location Share
- User navigates away from map → their `locationShares` doc status changes to `inactive`
- OR explicit "Done Sharing" button → marks status as `inactive`
- Polyline remains visible until they leave the group screen/map
- Other users unaffected—continue sharing and seeing others

## Firestore Data Model

### Collection: `locationShares`
```javascript
locationShares/{groupId}/{userId}
{
  groupId: string,
  userId: string,
  userName: string,
  userPhotoUrl: string (optional),
  destination: {
    lat: number,
    lng: number,
    name: string,
    placeId: string (optional)
  },
  currentLocation: {
    lat: number,
    lng: number,
    timestamp: serverTimestamp()
  },
  polyline: string (encoded polyline),
  waypoints: [{lat, lng, name}],
  vehicleType: string ('car', 'bike', 'scooter', 'bicycle', 'walker'),
  status: 'active' | 'arrived' | 'inactive',
  distanceMeters: number,
  durationSeconds: number,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

## Map Screen Architecture

### New State Variables
```javascript
// Group location sharing polylines (separate from user's primary route)
const [groupSharePolylines, setGroupSharePolylines] = useState({
  // { userId: { polyline, destination, waypoints, color, userName, vehicleType } }
});

// Track current sharing group
const [sharingGroupId, setSharingGroupId] = useState(null);

// Real-time listener for group shares
const [activeGroupShares, setActiveGroupShares] = useState([]);
```

### Mode Detection
```javascript
// From route params
const mode = route.params?.mode; // 'shareLocation' | 'normal'
const groupId = route.params?.groupId;

useEffect(() => {
  if (mode === 'shareLocation' && groupId) {
    setSharingGroupId(groupId);
    // Set up listener for all active shares in this group
  } else {
    setSharingGroupId(null);
  }
}, [mode, groupId]);
```

### Real-time Listener
```javascript
// Listen to all active locationShares for current group
useEffect(() => {
  if (!sharingGroupId) return;
  
  const q = query(
    collection(db, 'locationShares', sharingGroupId),
    where('status', '==', 'active')
  );
  
  const unsub = onSnapshot(q, (snapshot) => {
    const shares = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      shares[doc.id] = {
        userId: doc.id,
        ...data,
        color: getUserColor(doc.id), // Assign unique color per user
      };
    });
    setGroupSharePolylines(shares);
  });
  
  return unsub;
}, [sharingGroupId]);
```

### Location Tracking
```javascript
// Update user's currentLocation in locationShares doc as they move
useEffect(() => {
  if (!sharingGroupId || !userLocation) return;
  
  const unsub = watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const userShareRef = doc(db, 'locationShares', sharingGroupId, currentUserId);
      await updateDoc(userShareRef, {
        currentLocation: { lat: latitude, lng: longitude },
        updatedAt: serverTimestamp(),
      });
    },
    // error handler
  );
  
  return unsub;
}, [sharingGroupId, currentUserId]);
```

### Rendering Polylines
```javascript
// Main map renders both user's route + group share polylines
// User's primary route (routeCoords)
{routeCoords.length > 0 && (
  <Polyline
    key="user-main-route"
    coordinates={routeCoords}
    strokeColor={theme.colors.accentMid}
    strokeWidth={5}
    zIndex={900}
  />
)}

// Group share polylines (color-coded per user)
{Object.values(groupSharePolylines).map(share => (
  <Polyline
    key={`group-share-${share.userId}`}
    coordinates={decode(share.polyline)}
    strokeColor={share.color}
    strokeWidth={4}
    zIndex={800}
    opacity={0.8}
  />
))}

// Destination markers for group shares
{Object.values(groupSharePolylines).map(share => (
  <Marker
    key={`dest-${share.userId}`}
    coordinate={{
      latitude: share.destination.lat,
      longitude: share.destination.lng,
    }}
    title={share.destination.name}
    description={share.userName}
  />
))}
```

### Mini-map
```javascript
// Show simplified polylines + user dots
// Same polylines as main map but in small view
// Show all active group members as dots with their initials
```

## Files to Create/Modify

### New Files
- `core/map/utils/startLocationShare.js` - Initialize location share, compute polyline
- `core/map/utils/fetchLocationShares.js` - Listen to active shares for group
- `core/map/utils/updateLocationShare.js` - Update polyline, waypoints, status
- `core/map/utils/stopLocationShare.js` - Mark as inactive

### Modified Files
- `core/screens/GroupsScreen.js` - Add "Share Location" button
- `core/screens/MapScreenRN-TomTom.js`:
  - Add `groupSharePolylines` state
  - Add mode/groupId detection
  - Add real-time listener for group shares
  - Add location tracking updates
  - Add group share polyline rendering
  - Handle waypoint updates to save immediately
  - Color-code group members

## Waypoint Behavior

When user adds/removes waypoints in sharing mode:
1. New waypoints array computed
2. Google Maps API recalculates polyline with waypoints
3. `locationShares/{groupId}/{userId}` doc updated with new polyline + waypoints
4. Real-time listener on other clients picks it up
5. Their polylines on map update immediately

## Color Assignment

```javascript
const colors = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
];

function getUserColor(userId) {
  // Stable hash of userId to consistent color
  const hash = userId.charCodeAt(0) + userId.charCodeAt(1);
  return colors[hash % colors.length];
}
```

## Future Enhancements
- Multiple group sharing (allow user to share to multiple groups simultaneously)
- Geofence detection (auto-mark as 'arrived' when within X meters of destination)
- Group chat during location sharing
- Estimated arrival time calculation
- Ride quality ratings after completion
- History of shared location rides

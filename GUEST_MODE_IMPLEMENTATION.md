# Guest Mode Implementation Guide

## Overview
Guest mode allows unauthenticated users to browse the Coffee Rider map without creating an account. Guests have access to limited features controlled by the capabilities system.

## Architecture

### 1. **AuthContext Guest State** (`core/context/AuthContext.js`)
- **State**: `isGuest` boolean flag
- **Functions**:
  - `enterGuestMode()`: Sets isGuest=true and setLoading=false to bypass auth UI
  - `exitGuestMode()`: Sets isGuest=false to return to auth screens
  - `logout()`: Clears isGuest flag when signing out

### 2. **Capabilities System** (`core/roles/capabilities.js`)
Guest users have access to:
- **Map Tab**: Browse coffee shops (canAccessMap: true)
- **Profile Tab**: See login/register options (canAccessProfile: true)
- **All other tabs**: Disabled (groups, calendar, saved-routes)

Role-based permissions:
- **GUEST**: map, profile (login options)
- **USER**: map, saved-routes, profile
- **PLACE_OWNER**: map, calendar, profile
- **PRO**: all tabs
- **ADMIN**: all tabs + admin features

### 3. **Navigation Flow** (`app/_layout.js`)
```
LayoutContent
├─ if (!user && !isGuest) → Show AuthStack (login/register)
└─ if (user || isGuest) → Show Tabs with FloatingTabBar
   └─ Disabled tabs based on capabilities
```

### 4. **FloatingTabBar Dynamic Disabling** (`app/_layout.js`)
Each tab is disabled based on individual capability checks:
```javascript
const canAccessMap = capabilities?.canAccessMap === true;
const canAccessSavedRoutes = capabilities?.canAccessSavedRoutes === true;
const canAccessGroups = capabilities?.canAccessGroups === true;
const canAccessCalendar = capabilities?.canAccessCalendar === true;
const canAccessProfile = capabilities?.canAccessProfile === true;

tabs = [
  { name: "map", disabled: !canAccessMap },
  { name: "saved-routes", disabled: !canAccessSavedRoutes },
  { name: "groups", disabled: !canAccessGroups },
  { name: "calendar", disabled: !canAccessCalendar },
  { name: "profile", disabled: !canAccessProfile },
]
```

### 5. **Login Screen** (`core/auth/login.js`)
Added:
- "Continue as Guest" button below login options
- Calls `enterGuestMode()` and navigates to `/map`

### 6. **Register Screen** (`core/auth/register.js`)
Added:
- "Continue as Guest" button below login options
- Calls `enterGuestMode()` and navigates to `/map`

### 7. **Profile Screen for Guests** (`core/screens/ProfileScreen.js`)
When guest taps profile tab:
- Shows login/register buttons
- Shows "Continue Browsing" link to return to map without authenticating
- Calls `exitGuestMode()` to reset state if needed

## User Flow

### Starting as Guest
1. User launches app
2. Sees login/register screen with "Continue as Guest" button
3. Taps "Continue as Guest"
4. App calls `enterGuestMode()`
5. Navigates to `/map`
6. Guest can see FloatingTabBar with only map and profile tabs enabled
7. Guest can browse map freely
8. Guest can tap profile tab to see login/register options

### Guest to Authenticated
1. Guest taps profile tab
2. Sees login/register buttons
3. Taps "Log In" or "Create Account"
4. Navigates to `/auth/login` or `/auth/register`
5. After successful authentication, app loads user profile
6. `user` is set (no longer null)
7. Guest mode is exited automatically (isGuest remains false if user exists)
8. Full UI with all permitted tabs becomes available based on user role

### Returning to Browsing from Auth
Guest can tap "Continue Browsing" from profile screen:
1. Calls `exitGuestMode()`
2. Sets isGuest to false
3. Navigates back to `/map`
4. Since both user and isGuest are false, app shows auth screens again
5. Guest can tap "Continue as Guest" again to re-enter guest mode

## Files Modified

| File | Changes |
|------|---------|
| `core/context/AuthContext.js` | Added isGuest state, enterGuestMode(), exitGuestMode() |
| `app/_layout.js` | Updated LayoutContent to check isGuest, Updated FloatingTabBar for capability checks |
| `core/auth/login.js` | Added "Continue as Guest" button and handleGuestMode() |
| `core/auth/register.js` | Added "Continue as Guest" button and handleGuestMode() |
| `core/screens/ProfileScreen.js` | Added guest mode profile view with login/register options |
| `core/roles/capabilities.js` | Added tab access capabilities for all roles |

## Testing Guest Mode

1. **Start App**: Should show login/register with "Continue as Guest" button
2. **Tap Continue as Guest**: Should navigate to map with only map + profile tabs
3. **Tap Profile Tab**: Should show login/register options with "Continue Browsing" link
4. **Tap Continue Browsing**: Should return to map, show auth screens on restart
5. **Login from Guest Mode**: After login, should show all permitted tabs based on role
6. **Logout**: Should return to login screen, clearing guest mode flag

## Capability-Based Access Control

All features respect the role-based capabilities system:
- Tabs are disabled in FloatingTabBar based on canAccess* flags
- Profile screen shows different UI for guests
- Each role has specific permissions defined in capabilities.js

This ensures:
- Guests can explore without commitment
- Users can save routes and access groups
- Place owners can manage calendar
- Pro users get full access
- Admins have complete control

# iOS Porting Plan - Coffee Rider v2

**Status:** Starting iOS port development  
**Current Branch:** `ios-port`  
**Main Branch Status:** ✅ Stable (Android)  
**Date Started:** January 22, 2026

---

## Branch Strategy

- **`main`** → Android production-ready, kept stable
- **`ios-port`** → Isolated iOS development, all iOS changes here
- **Merge back to main** → Only when both platforms tested and working together

---

## Critical Priority Items (3-4 hours total)

### 1. 🔴 iOS Location Permissions
**File:** `app.config.js`  
**Needed:**
- Add `infoPlist` section with location descriptions
- Keys: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`
- Add `backgroundModes: ["location", "fetch"]` for Follow Me background tracking

**Importance:** Follow Me won't work without this

---

### 2. 🔴 GoogleService-Info.plist
**File:** `app.config.js` references this at line 91  
**Needed:**
- Download from Firebase console for iOS
- Add to project root
- Ensure different API keys for iOS vs Android are configured

**Importance:** Firebase auth + Firestore won't work without this

---

### 3. 🟡 Splash Video Format
**File:** `core/components/ui/SplashScreen.js`  
**Current:** `.mov` format  
**Action:** Test on iOS simulator or convert to `.mp4`

**Importance:** Video playback differs on iOS

---

### 4. 🟡 Safe Area + Notch Handling
**File:** `app/_layout.js`  
**Check:** FloatingTabBar positioning with iPhone notch/Dynamic Island

**Importance:** UI doesn't overlap system areas

---

### 5. 🟠 Keyboard Behavior
**Files:** `core/auth/login.js`, `core/auth/register.js`  
**Test:** Auth screens with iOS keyboard

**Importance:** Inputs shouldn't get hidden

---

## Implementation Order

1. **Phase 1:** Location permissions + Firebase setup (30 min)
2. **Phase 2:** Splash video + UI layout testing (1 hour)
3. **Phase 3:** Full build & simulator testing (1.5 hours)
4. **Phase 4:** Test Follow Me on iOS + validate all features (1 hour)

---

## Pre-Build Checklist

- [ ] iOS location permissions configured
- [ ] GoogleService-Info.plist added
- [ ] Splash video tested or converted
- [ ] Safe area tested on notched device
- [ ] Auth screens tested
- [ ] Build succeeds: `eas build --platform ios --local`

---

## Testing Checklist (Pre-Merge)

- [ ] App launches on iOS simulator
- [ ] Authentication works
- [ ] Map displays and updates
- [ ] Location tracking works
- [ ] Follow Me mode works (15-min test)
- [ ] All search features work
- [ ] Filters apply correctly
- [ ] PlaceCard displays correctly
- [ ] No crashes on main features

---

## Rollback Plan

If iOS port encounters blockers:
1. Stay on `ios-port` branch
2. `git checkout main` to return to stable Android
3. Main branch remains unaffected
4. Can restart or continue debugging on `ios-port` later

---

## Next Steps

1. Start with location permissions config in `app.config.js`
2. Add GoogleService-Info.plist 
3. Test splash video
4. Build and run on iOS simulator

**Ready to proceed?** Let me know when you have the GoogleService-Info.plist from Firebase console.

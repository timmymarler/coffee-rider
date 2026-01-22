# iOS Testing Setup - Mac Instructions

**Branch:** `ios-port`  
**Status:** Ready for Mac testing  
**Date:** January 22, 2026

---

## ✅ Completed on Windows

### Configuration Changes Made:
1. **iOS Location Permissions** (`app.config.js` lines 85-97)
   - ✅ `NSLocationWhenInUseUsageDescription` - for foreground location
   - ✅ `NSLocationAlwaysAndWhenInUseUsageDescription` - for background tracking (Follow Me)
   - ✅ `UIBackgroundModes: ["location", "fetch"]` - enables background location
   - ✅ `NSMotionUsageDescription` - for motion data accuracy

2. **Firebase Setup**
   - ✅ GoogleService-Info.plist exists in project root
   - ✅ Platform-specific API keys configured

3. **Splash Video**
   - ✅ Coffee-Rider-Splash.mov exists (0.51 MB)
   - ✅ Format compatible with iOS

### Fallback Safety
- ✅ `main` branch remains stable (Android only)
- ✅ All iOS changes isolated on `ios-port` branch
- ✅ Can revert to `main` anytime if needed

---

## Mac Setup Steps

### 1. Clone/Update Repository

If first time:
```bash
git clone https://github.com/timmymarler/coffee-rider.git
cd coffee-rider-v2
```

If already cloned:
```bash
cd coffee-rider-v2
git fetch origin
```

### 2. Checkout ios-port Branch
```bash
git checkout ios-port
```

### 3. Install Dependencies
```bash
npm install
cd ios && pod install && cd ..
```

### 4. Setup Environment Variables
Verify `.env` file has iOS-specific API keys:
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS=your-key
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_IOS=your-key
EXPO_PUBLIC_FIREBASE_API_KEY_IOS=your-key
```

### 5. Build for iOS Simulator

**Option A: Local build (requires Xcode)**
```bash
npx expo run:ios
```

**Option B: EAS Build (cloud build, recommended)**
```bash
eas build --platform ios --local
```

---

## Testing Checklist

### Core Functionality
- [ ] App launches without errors
- [ ] Splash video plays correctly
- [ ] Authentication screen displays
- [ ] Can log in with existing account

### Location & Permissions
- [ ] Location permission prompt appears on first load
- [ ] "Allow While Using App" and "Allow Always" options visible
- [ ] Map loads and shows user location
- [ ] GPS tracking works

### Map & Places
- [ ] Map displays correctly (no distortions)
- [ ] Markers appear for nearby places
- [ ] Tap marker → PlaceCard opens
- [ ] Filters work (categories, amenities)
- [ ] Search functionality works

### Follow Me Mode
- [ ] Toggle Follow Me on
- [ ] Background location tracking enabled in Settings
- [ ] Zoom level appropriate for Follow Me
- [ ] Location updates smoothly while moving
- [ ] No crashes after 5+ minutes of tracking

### UI/UX on iPhone
- [ ] Safe area respected (no overlap with notch/home indicator)
- [ ] FloatingTabBar positioned correctly
- [ ] Keyboard doesn't hide auth inputs
- [ ] All text readable (no overflow)
- [ ] Touch targets appropriately sized

### Performance
- [ ] No unusual lag or stuttering
- [ ] Reasonable memory usage
- [ ] Maps scroll/zoom smoothly
- [ ] No battery drain during normal use

---

## Expected Outcomes

### If All Tests Pass ✅
1. Both Android and iOS work identically
2. Ready to merge `ios-port` → `main`
3. Can proceed to Follow Me road testing
4. Ready for app store submission process

### If Issues Found 🔧
1. Document issue with:
   - Device/OS version
   - Steps to reproduce
   - Error logs (if any)
2. Fix on `ios-port` branch
3. Re-test
4. Do NOT merge to `main` until stable

### If Critical Blocker ⚠️
1. Stay on `ios-port`
2. `git checkout main` to return to stable Android
3. Main branch unaffected
4. Can debug further or restart approach

---

## Troubleshooting

### "Pod install fails"
```bash
cd ios
rm Podfile.lock
pod repo update
pod install
cd ..
```

### "Build fails with SDK error"
- Ensure Xcode is up to date: `xcode-select --install`
- Clear build cache: `npx expo run:ios --clear`

### "Location permission not requesting"
- Check iOS simulator settings: Settings → Coffee Rider → Location
- Ensure `UIBackgroundModes` in app.config.js

### "Splash video doesn't play"
- Check file exists: `ls assets/Coffee-Rider-Splash.mov`
- Verify format: Should be `.mov` or `.mp4`

### "Map doesn't show"
- Verify GoogleService-Info.plist exists: `ls GoogleService-Info.plist`
- Check Firebase API keys in `.env`
- Verify GoogleMaps API enabled in Firebase console

---

## Quick Reference

**Branch:** ios-port  
**Config file:** app.config.js  
**Video:** assets/Coffee-Rider-Splash.mov (0.51 MB)  
**Firebase:** GoogleService-Info.plist (root level)  
**Permissions:** Configured in app.config.js lines 85-97  

---

## Next Steps After Testing

1. **If successful:** Merge ios-port → main
2. **Both devices:** Ready for Follow Me road testing
3. **Document results:** Update project status
4. **App store:** Begin submission process

---

**Questions?** Check iOS_PORTING_PLAN.md for detailed context.

// QUICK START GUIDE - TESTING THE NEW FEATURES
// Coffee Rider v2.2.0

## 🎯 HOW TO TEST THE CALENDAR FEATURE

### Step 1: Register as a Place Owner

1. Rebuild the mobile app:
   ```bash
   cd c:\Users\Tim Marler\coffee-rider-v2
   eas build --platform android --local  # or iOS
   ```

2. Open the app and tap "Register"

3. Fill in the form:
   - Display Name: "Test Place"
   - Role selector: Select "Place Owner"
   - Place Name: "My Coffee Shop"
   - Category: Select "Cafe"
   - Email: place-owner@test.com
   - Password: testpass123

4. You should now be logged in with place owner role

### Step 2: Set Up Your Place Details

1. Go to Profile tab
2. You'll see a new "Place Details" section at the bottom
3. Fill in:
   - Place Name: "My Coffee Shop"
   - Category: Cafe
   - Address: "123 Main St, Town, Postcode"
   - Amenities: "WiFi, Parking, Food" (comma separated)
4. Tap "Save"

### Step 3: Create an Event

1. Go to Calendar tab (new tab in the navigation)
2. Look at the calendar grid showing current month
3. Tap "+ Create Event" button (bottom of screen)
4. Fill in event details:
   - Title: "Coffee Meetup"
   - Description: "Meet other riders"
   - Place: Select your place
   - Start: Pick a date/time
   - Region: "South East" (example)
   - Suitability: Select "Bikes"
   - Recurrence: "one-off"
5. Tap "Create Event"

### Step 4: View Your Event

1. Return to Calendar tab
2. Navigate to the month/day of your event
3. You should see the event count on that day
4. Tap on the day to see event details
5. Event should show: Time, title, place name, suitability, attendee count

### Step 5: Test Filtering

1. Tap "Filters" button
2. Select a region (your event's region should filter correctly)
3. Select suitability type
4. Events should update to show only matching results

### Step 6: Test Place Comments

1. Go to Map tab
2. Tap on a place marker to view its details
3. Scroll down to see "Comments" section
4. Add a comment: "Great place!"
5. See your comment appear in real-time
6. Tap "Reply" to add a reply
7. Tap trash icon to delete (if you own it)

## 🧪 TEST SCENARIOS

### Scenario 1: Basic Event Creation
- Register as place owner ✓
- Create event ✓
- View in calendar ✓
- See attendee count (should be 1 - just you) ✓

### Scenario 2: Recurring Events
- Create weekly event (repeats every week for 1 year) ✓
- Create monthly event on specific date (e.g., 15th) ✓
- Create monthly event on pattern (e.g., 1st Wednesday) ✓
- Should generate 52 weekly or 12 monthly instances ✓

### Scenario 3: Role-Based Access
- Register as rider (no event creation) ✓
- See "Create Event" button only as place owner/pro ✓
- Riders can still view calendar and join events ✓

### Scenario 4: Filtering
- Create events in different regions ✓
- Filter by region - should show only matching ✓
- Filter by suitability - should show only Bikes/Scooters/Cars ✓
- Combine filters - should show only events matching both ✓

### Scenario 5: Comments
- Add comment to a place ✓
- See your name and timestamp ✓
- Reply to your own comment ✓
- Delete your comment ✓

## 📱 NAVIGATION

### Main App Tabs (FloatingTabBar)
1. Map (existing)
2. Saved Routes (existing)
3. Groups (existing)
4. Calendar (NEW)
5. Profile (existing)

### Calendar Tab Flow
- Calendar (month view) → Select day → View events → Create Event

### Profile Tab
- When place owner: Shows place details editor
- All roles: Display name, bike, bio fields

## 🔍 FIRESTORE VERIFICATION

To verify data is being saved correctly:

1. Open Firebase Console → Firestore Database
2. Check collections:
   - `users/{uid}` - Should have `role` field and `place` object for place owners
   - `events/` - Should contain your created events
   - `places/{placeId}/comments/` - Should show your comments

Expected document structure:
```
User (place owner):
{
  displayName: "Test Place",
  email: "place-owner@test.com",
  role: "place-owner",
  place: {
    name: "My Coffee Shop",
    category: "cafe",
    address: "123 Main St...",
    amenities: ["WiFi", "Parking", "Food"]
  }
}

Event:
{
  title: "Coffee Meetup",
  placeId: "...",
  placeName: "My Coffee Shop",
  startDateTime: Timestamp,
  region: "South East",
  suitability: ["Bikes"],
  createdBy: "user-uid",
  attendees: ["user-uid"],
  recurrenceType: "one-off"
}

Comment:
{
  text: "Great place!",
  createdBy: "user-uid",
  createdByName: "John",
  createdAt: Timestamp
}
```

## ⚠️ KNOWN LIMITATIONS (To Fix)

1. **Date Picker**: Currently shows Alert placeholder. Need to integrate:
   - react-native-date-picker (mobile)
   - react-datepicker (web)

2. **Place Selection**: Create Event assumes place owner has places. If none exist, form needs error handling.

3. **Recurrence Display**: Creates multiple event documents. Could optimize with parent-child relationships later.

4. **Recurring Event Editing**: Updating one event doesn't affect others. Need to add "Edit this & future" option.

5. **Event Time Zones**: Currently uses device timezone. Should consider user's region timezone preference.

## 🛠️ DEBUGGING TIPS

Enable debug logs in ProfileScreen:
1. Go to Profile
2. Scroll to "Debug Logs" section
3. Tap to expand
4. View real-time app logs
5. Copy logs to clipboard for analysis
6. Clear logs when done

Check console for errors:
```bash
# While running dev server
npx expo start --clear
```

Monitor Firestore in real-time:
```bash
# In another terminal
firebase emulator:start
```

## 📝 NEXT STEPS AFTER TESTING

1. ✅ Test all scenarios above
2. Integrate real date picker
3. Add event edit/update capability
4. Add attendee management (join/leave)
5. Create event notification system
6. Build place owner dashboard
7. Add analytics for events
8. Deploy to production

## 🎉 SUCCESS INDICATORS

You'll know everything is working when:
- ✅ Calendar tab appears in navigation
- ✅ Place owner can create events
- ✅ Events appear on calendar grid
- ✅ Filtering works correctly
- ✅ Comments appear in real-time
- ✅ All data persists after app restart
- ✅ No console errors

## 📞 TROUBLESHOOTING

**Event not appearing in calendar:**
- Check Firestore → events collection
- Verify event date matches selected calendar month
- Check filtering isn't excluding it
- Look for console errors

**Comments not showing:**
- Check Firestore → places/{placeId}/comments
- Verify you're authenticated
- Check Firebase rules allow reading
- Clear app cache and reload

**Can't create event:**
- Verify you're logged in as place owner
- Check you've set up a place in profile first
- Look for validation errors in form
- Check Firestore rules (events collection)

**Calendar not loading:**
- Verify Firebase connection
- Check internet connectivity
- Clear app cache
- Force stop and restart app

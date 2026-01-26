// WEB APP CALENDAR FEATURE (Next Phase)
// Implementation roadmap for web-app/src/

## 🎯 PRIORITY ORDER FOR WEB APP

### Phase 1: User Roles (Mobile Complete, Web Pending)
1. Update web Registration to include role selection
2. Create role-based UI (profile shows role, place owner section)
3. Sync with mobile user schema

**Estimated:** 1-2 hours

**Files to Create:**
- web-app/src/pages/Register.jsx (update)
- web-app/src/pages/Profile.jsx (new)
- web-app/src/hooks/useProfile.js (new)

### Phase 2: Calendar Component
1. Build calendar month view (reuse similar CSS patterns)
2. Add event display and filtering
3. Real-time event subscription

**Estimated:** 2-3 hours

**Files to Create:**
- web-app/src/pages/Calendar.jsx (new)
- web-app/src/hooks/useWebEvents.js (web-specific version)
- web-app/src/components/EventCard.jsx
- web-app/src/components/EventFilters.jsx

### Phase 3: Event Creation
1. Event form page
2. Place selection (load user's places from Firestore)
3. Recurrence pattern UI
4. Form validation

**Estimated:** 2 hours

**Files to Create:**
- web-app/src/pages/CreateEvent.jsx
- web-app/src/components/RecurrenceSelector.jsx
- web-app/src/hooks/useEventForm.js (adapt from mobile)

### Phase 4: Comments System
1. Comments component for place cards
2. Reply functionality
3. Real-time updates

**Estimated:** 1-2 hours

**Files to Create:**
- web-app/src/components/CommentsSection.jsx
- web-app/src/hooks/useComments.js (adapt from mobile)

## 🔄 CODE REUSE

These hooks can be shared between mobile and web:
- useEvents.js (Firestore logic is identical)
- useComments.js (Firestore logic is identical)
- useEventForm.js (form state logic is identical)

**Action:** Move these to a shared location and import in both mobile and web apps.

Suggested structure:
```
shared/
  hooks/
    useEvents.js
    useComments.js
    useEventForm.js
```

## 🎨 WEB APP STYLING NOTES

Calendar:
- Use React Calendar library (react-big-calendar) for advanced views
- Match mobile color scheme: #8B6F47 (coffee), #667eea (accent)
- Responsive: Grid layout adjusts to screen size
- Dark mode support via theme context (already in place)

Event Creation Form:
- Similar layout to Register.jsx
- Use date-fns for date picking
- Multi-select for suitability and region
- Preview event details before submission

Comments:
- Nested reply structure matches mobile
- Real-time via Firestore listener
- Edit/delete with confirmation dialogs
- Avatar placeholder with initials

## ✅ READINESS CHECK

Current web app status:
- ✅ Firebase Auth working (login/register)
- ✅ Firestore connected
- ✅ Map component live
- ✅ Places/routes/groups displaying
- ❌ User profile/settings page
- ❌ Calendar implementation
- ❌ Event creation
- ❌ Comments system

## 📋 DEPLOYMENT TO HOSTINGER

When ready to deploy web app:

1. Build production bundle:
   ```bash
   cd web-app
   npm run build
   ```

2. Configure Hostinger:
   - Upload `dist/` folder to public_html/
   - Set up redirect rules for SPA routing
   - Enable HTTPS
   - Configure CORS for Firebase domain

3. Environment variables (.env.production):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   ```

4. DNS configuration:
   - Point domain to Hostinger nameservers
   - Allow 24-48 hours for propagation

## 🚀 QUICK START FOR WEB APP

If you want to start now:

1. Create Register.jsx with role selection (copy mobile logic)
2. Update hooks to work with web (remove React Native imports)
3. Create basic Calendar.jsx using react-big-calendar
4. Implement useEvents for web
5. Build event form with date picker library

## 📚 RECOMMENDED LIBRARIES

- react-big-calendar (for calendar UI)
- date-fns (date manipulation)
- react-select (multi-select dropdowns)
- react-toastify (notifications)

All are lightweight and work well with Vite.

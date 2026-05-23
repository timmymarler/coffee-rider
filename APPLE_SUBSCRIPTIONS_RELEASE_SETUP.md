# Apple Subscriptions Release Setup

This checklist covers the required release setup for Apple subscriptions in Coffee Rider.

## 1) Configure Cloud Function secret

Set the Apple shared secret in Firebase Functions config:

```bash
cd functions
firebase functions:config:set apple.shared_secret="YOUR_APP_STORE_SHARED_SECRET"
```

Notes:
- The backend reads `APPLE_SHARED_SECRET` from env or `functions.config().apple.shared_secret`.
- Keep this secret out of source control.

## 2) Deploy Cloud Functions

Deploy functions so iOS purchases can call `activateAppleSubscription` and App Store notifications are processed by `appleServerNotification`.

```bash
cd functions
npm install
npm run deploy
```

If you want to deploy only the Apple functions:

```bash
cd functions
firebase deploy --only "functions:activateAppleSubscription,functions:appleServerNotification"
```

## 3) Configure App Store Server Notifications

In App Store Connect:
1. Open your app.
2. Go to App Information -> App Store Server Notifications.
3. Set the Production URL to:

```text
https://us-central1-coffee-rider-bea88.cloudfunctions.net/appleServerNotification
```

4. Set the Sandbox URL to the same endpoint.
5. Save and send a test notification.

## 4) Verify product IDs and bundle ID

Confirm these values in App Store Connect match app config and EAS build env:
- Monthly product: `com.timmy.marler.coffeerider.pro.monthly`
- Annual product: `com.timmy.marler.coffeerider.pro.annual`
- iOS bundle ID: `com.timmy.marler.coffeerider`

## 5) Smoke test after deploy

1. Install a new iOS build from TestFlight.
2. Buy monthly and annual plans using Sandbox tester.
3. Confirm Firestore `users/{uid}/subscription/current` updates:
   - `provider = apple_iap`
   - `status = active`
   - `renewalDate` populated
4. Trigger a restore and confirm the same document updates.
5. In App Store Connect, send a notification test and confirm backend receives `received: true`.

## Implementation Notes

- `activateAppleSubscription` validates receipts with Apple (`verifyReceipt`) before activating access.
- `appleServerNotification` handles App Store Server Notifications (v2 signed payload format), updates subscription state, and syncs user access role.
- Notification processing is idempotent by `notificationUUID` via `appleNotifications/{notificationUUID}` docs.

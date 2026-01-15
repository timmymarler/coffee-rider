# Version Gating Setup

This guide explains how to set up version gating in your Coffee Rider app.

## Firestore Structure

Create a collection called `versions` in your Firestore database with a document for each app variant (rider, driver, strider).

### Document Structure: `/versions/rider`

```
{
  "latestVersion": "1.2.0",
  "minimumVersion": "1.0.0",
  "releaseNotes": "- Fixed polyline issue\n- Improved map performance\n- Added version gating",
  "forceUpgradeAt": 1705332000  // (optional) Unix timestamp
}
```

### Field Descriptions

- **latestVersion** (string, required): The latest available version of the app (e.g., "1.2.0")
- **minimumVersion** (string, optional): The minimum version required to use the app. If the user's version is below this, they'll be forced to update
- **releaseNotes** (string, optional): Release notes to display in the modal
- **forceUpgradeAt** (number, optional): Unix timestamp. When provided, users won't be able to dismiss optional updates after this date

## How It Works

1. When the app launches, `AuthContext` fetches the version info from Firestore
2. It compares the current app version (from `package.json`) with the versions in Firestore
3. If an update is available:
   - **Optional update**: Shows a modal with "Later" and "Update Now" buttons. User can dismiss once and see again next launch
   - **Required update**: Shows a modal with only "Update Now" button. User cannot dismiss
4. Tapping "Update Now" opens the app store

## Version Comparison Logic

Versions are compared as semantic versioning (e.g., "1.2.3"):
- If current version < minimumVersion → **Required update**
- If current version < latestVersion → **Optional update**
- Otherwise → Current version is up-to-date

## Customization

### Change the Store URL

In `app.config.js`, add to the `extra` section:

```javascript
extra: {
  appName: APP_NAME,
  storeUrl: "https://play.google.com/store/apps/details?id=com.timmy.marler.coffeerider",
  // ... other config
}
```

Or the modal will use a default URL.

### Disable Version Gating Temporarily

In `core/context/AuthContext.js`, comment out the version check effect if needed.

## Testing

1. Update `minimumVersion` in Firestore to "2.0.0" (higher than your app version)
2. Reload the app
3. You should see the "Update Required" modal

To test optional updates:
1. Set `latestVersion` to "2.0.0"
2. Remove or lower `minimumVersion`
3. Reload the app
4. You should see the "Update Available" modal with a "Later" button

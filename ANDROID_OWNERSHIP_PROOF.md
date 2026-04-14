# Android Ownership Proof Build (Safe Mode)

This flow is isolated from normal release builds.

## Why this is safe

- Uses dedicated EAS profile: `ownership-proof`
- Profile extends your production config, but only changes output type to APK
- Does not alter app runtime code or your normal production submit profile

## Canonical token file

Keep only this file:

- `android/app/src/main/assets/adi-registration.properties`

Do not keep duplicates in other paths.

## One-click command

```bash
npm run android:ownership-proof
```

## What this command does

- Builds Android APK with clean cache
- Uses `ownership-proof` profile in `eas.json`
- Includes Android native source via `.easignore` rules

## Before uploading to Play

After downloading the APK from EAS, confirm the token file exists in the APK:

```bash
unzip -l YOUR_FILE.apk | grep adi-registration.properties
```

Expected output includes:

```text
assets/adi-registration.properties
```

If present, upload that APK for package ownership verification.

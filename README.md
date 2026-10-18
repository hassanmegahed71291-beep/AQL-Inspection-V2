# AQL Inspection — Cross-platform starter package

This package preserves the latest microphone-enabled AQL inspection HTML and adds a PWA shell, Capacitor Android/iOS project configuration, a native speech-recognition bridge, Supabase database sync, and private cloud-photo storage integration.

## Important status
- The app source and static JavaScript syntax can be checked here, but this package has **not** been run on a physical Android/iPhone or submitted to either app store.
- Cloud syncing only works after the SQL setup is run on the Supabase project, a user account is created, and the user creates/joins a workspace from **Settings → Cloud database & multi-device sync**.
- The Supabase publishable/anon key is intended for client apps; never use a `service_role` key in the app. Confirm the configured project and RLS policies before production use.
- The app still uses local IndexedDB for the immediate working copy; cloud data is uploaded/downloaded using the cloud-sync controls. This is not automatic real-time synchronization.
- Native speech uses the Capacitor community speech-recognition plugin. Native microphone permissions and speech service availability must be tested on real devices.

## 1. Supabase setup
1. Open the Supabase project configured in the app, or update the URL and publishable/anon key under Settings.
2. Open **SQL Editor** and run `AQL_Supabase_Setup.sql` in full.
3. In Authentication settings, decide whether email confirmation is required. Confirm email addresses if enabled.
4. Use Settings → Cloud database & multi-device sync: test connection, create/sign into an account, create a workspace on the manager device, then share the join code only with authorized users.
5. Back up local data before first upload/download. Use **Sync both ways** only after confirming workspace and records.

## 2. Test as a web app / PWA
Run `npm install`, then `npm run dev`. For microphone and install testing, deploy the built app over HTTPS (or use localhost for development). Android Chrome supports installing the PWA. On iPhone, open the HTTPS site in Safari and use Share → Add to Home Screen.

## 3. Build Android / iOS app
Requirements: Node.js LTS and npm; Android Studio + Android SDK for Android; macOS + Xcode for iOS builds.

```bash
npm install
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android
npx cap open ios
```

If `android/` or `ios/` already exists, do not run `cap add` again; run `npx cap sync` instead. iOS builds require a Mac with Xcode. App-store distribution requires developer accounts and signing. After `npx cap add ios`, add the two permission strings from `ios-InfoPlist-snippet.xml` into `ios/App/App/Info.plist`; Apple requires microphone and speech-recognition usage descriptions for the native speech plugin.

## 4. Required device tests before production
- Arabic and English voice entry, permission denied/retry, no-speech, offline/no-network, stop/restart.
- Camera/photos and photo annotations; verify photo uploads and downloads from a second device.
- Create an inspection, sync, sign in on a second device, download, compare record fields and images.
- PDF, Excel, printing/sharing to WhatsApp on both operating systems.
- Confirm access isolation: a user in one workspace cannot read another workspace's records or photos.
- Test large inspections/photo batches, flaky network, app background/resume, logout, and restore from backup.

## Known limitations
- Sync is manual, not real-time. User/member PINs remain local-only and should not be considered server-grade authentication/role enforcement. Cloud account access is separate from local member PINs.
- The cloud schema is a first-stage foundation. Before multi-factory production, perform a security review, define workspace role-based policies, implement server-backed user roles, conflict resolution/versioning, orphan-photo cleanup, and formal backup/retention policies.
- Speech-to-text depends on native OS speech services; some languages/devices may require internet and system language packs.

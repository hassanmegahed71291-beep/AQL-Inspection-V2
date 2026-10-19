# SETUP — AQL Inspection (Supabase + OAuth + Secrets)

This file lists the minimal steps to configure the Supabase backend, enable OAuth providers, and add repository secrets required by the enhanced AQL inspection app.

IMPORTANT: Do not commit secrets into the repository. Add them as GitHub repository secrets instead.

## 1) Import database schema into Supabase
1. Create or use a Supabase project.
2. Open the SQL editor.
3. Run the SQL schema file `AQL_Supabase_Setup.sql` in the repository root when available, or create equivalent tables for:
   - inspections
   - aql_cloud_records
   - rejections / audit entries (optional)
   - storage bucket for photos

## 2) Enable authentication providers
In Supabase Dashboard → Authentication → Providers:
- Google: enable and add Client ID + Client Secret from Google Cloud Console.
- Facebook: enable and add Client ID + Client Secret.
- Add redirect URL(s) as shown by Supabase in Auth → URL Configuration.

## 3) Storage bucket
Create a bucket such as:
- `aql-photos`

Use it for defect and item photos.

## 4) GitHub repository secrets
Add these under repository Settings → Secrets and variables → Actions:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (optional for server-side operations)
- OAUTH_GOOGLE_CLIENT_ID
- OAUTH_GOOGLE_CLIENT_SECRET
- OAUTH_FACEBOOK_CLIENT_ID
- OAUTH_FACEBOOK_CLIENT_SECRET
- FCM_SERVER_KEY / FCM_SENDER_ID (optional for push notifications later)

## 5) Local development
1. Checkout the working branch:
   git checkout feature/inspection-enhancements-15
2. Install dependencies:
   npm install
3. Launch the app:
   npm run dev
4. For mobile/native microphone support, use a secure context or Capacitor / Android / iOS build.

## 6) Test Realtime notifications
The app subscribes to inspection updates and triggers an in-app toast when an inspection changes to `rejected`.

To test:
- Sign in to Supabase Studio.
- Update an inspection record status to `rejected`.
- A manager session in the app should show a toast notification.

## 7) Notes
- The code intentionally uses placeholders for sensitive values.
- Do not expose service role keys in browser-side code.
- If you want real browser push notifications (FCM), additional Firebase configuration is required.

---

This document is intentionally concise. The enhanced app already contains placeholders and integration hooks for Supabase auth, realtime notifications, and the additional UI features.

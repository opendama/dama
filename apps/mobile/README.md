# dama mobile (`apps/mobile`)

Flutter player app for dama (BLoC / Cubit). Production package id: `com.opendama.mobile` (Android + iOS). Version from `pubspec.yaml`.

## Local run

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=DAMA_API_ORIGIN=https://api.opendama.com --dart-define=DAMA_SUPABASE_URL=... --dart-define=DAMA_SUPABASE_ANON_KEY=... --dart-define=DAMA_WEB_ORIGIN=https://www.opendama.com
```

OAuth redirect comes from DB `app_shell_chrome.mobile_oauth_redirect_url` (not invented in the client). Register the same URL in Supabase Redirect URLs.

## Production builds

- Android AAB: `.\scripts\build-prod-android.ps1` (needs `android/key.properties` for Play signing)
- iOS IPA (macOS): `./scripts/build-prod-ios.sh` (needs `ios/Flutter/Signing.xcconfig`)

See `STORE_PACKAGING.md` for Play / App Store Console ops.

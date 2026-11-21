# Store packaging (ops + repo alignment)

Native `android/` and `ios/` scaffolds ship in-repo. Age rating and RMG questionnaires are completed in Play Console / App Store Connect at submit time.

Package IDs and OAuth deep links are seeded in `platform_settings.app_shell_chrome` (migration **540**) and must match native manifests:

| Key | Value |
|-----|--------|
| `mobile_android_application_id` | `com.opendama.mobile` |
| `mobile_ios_bundle_id` | `com.opendama.mobile` |
| `mobile_display_name` | `Dama` (must match `android:label` and `CFBundleDisplayName`) |
| `mobile_oauth_scheme` | `com.opendama.mobile` |
| `mobile_oauth_host` | `login-callback` |
| `mobile_oauth_redirect_url` | `com.opendama.mobile://login-callback/` |

Native display names are build-time constants. Keep them identical to DB `mobile_display_name`. Do not invent a second brand string in clients.

## Android (Play Console)

1. Create app with package name **exactly** `com.opendama.mobile`.
2. Enroll in Play App Signing (Google holds the app signing key; you keep the upload keystore).
3. Upload AAB: `apps/mobile/build/app/outputs/bundle/release/app-release.aab` (built via `.\scripts\build-prod-android.ps1`).
4. If R8 mapping is produced, upload `build/app/outputs/mapping/release/mapping.txt` under App bundle explorer / deobfuscation.
5. Store listing: title, short description, full description, app icon, feature graphic, phone screenshots (tablet optional).
6. Privacy policy URL: live web `/privacy` (for example `https://www.opendama.com/privacy`).
7. Support / contact URL or email as required by Play forms.
8. Content rating (IARC): **17+** skill competitions, **not** casino / gambling.
9. Data safety: location (precise/coarse), photos/camera for KYC and receipts; **no AdMob**; declare data shared only as your policy states.
10. Real-money / paid entry declarations where asked (skill competitions with wallet entry; not gambling framing).
11. Track: **Internal testing** first, then closed/open, then production when green.
12. Version bumps: change `apps/mobile/pubspec.yaml` `version:` (`1.0.0+N` where `+N` is `versionCode`).

### Release signing (this PC)

- Copy `android/key.properties.example` to `android/key.properties` (gitignored).
- Keep `upload-keystore.jks` and passwords offline forever. Losing them blocks updates under the same upload key.
- Build: `cd apps/mobile; .\scripts\build-prod-android.ps1`
- Release builds enable minify + resource shrink with `android/app/proguard-rules.pro`.

### Supabase

- Auth Redirect URLs must include `com.opendama.mobile://login-callback/**`

## iOS (App Store Connect)

1. Create app with bundle id **exactly** `com.opendama.mobile`.
2. Copy `ios/Flutter/Signing.xcconfig.example` to `Signing.xcconfig` and set `DEVELOPMENT_TEAM` (gitignored).
3. Build on macOS: `./scripts/build-prod-ios.sh` then upload IPA via Xcode Organizer or Transporter.
4. Age rating **17+**; privacy nutrition labels: location + photos; tracking **off** (`PrivacyInfo.xcprivacy`).
5. Screenshots: iPhone required; iPad if iPad support stays enabled.
6. Privacy policy URL: same live `/privacy`.
7. RMG: **corporate** Apple Developer account (Guideline 5.3).
8. Track: **TestFlight** first, then App Review.
9. `PrivacyInfo.xcprivacy` ships Required Reason API categories used by Flutter/plugins (UserDefaults, file timestamp, disk space, system boot time).

### Supabase

- Auth Redirect URLs must include `com.opendama.mobile://login-callback/**`

## Web / admin SEO (DB-driven)

Migration **540** also seeds `seo_locale`, `seo_og_type`, `seo_robots_allow`, `seo_robots_disallow`, `seo_sitemap`. Web `robots.ts` / `sitemap.ts` / layout metadata read these via `/public/app-shell-chrome` only (fail closed when missing). Admin stays `noindex` via `admin_robots`.

## Product gates (already in API)

Cash enroll / checkout / payout refuse until age, allowlist country, fresh locate, phone KYC (when flagged), and government-ID document KYC (when `require_document_kyc_for_payout`: ID front/back + selfie + legal name + document type; admin-approved) succeed. Fail closed from DB policy.

Community host trust / scammer protection (phone for paid create; government ID + wallet lock for guaranteed prizes; open-cup limits; badges): see `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.

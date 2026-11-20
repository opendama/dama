# Store packaging (item 7 - ops, not product feature)

Native `android/` and `ios/` scaffolds ship in-repo. Age rating and RMG questionnaires are completed in Play Console / App Store Connect at submit time.

## Android (Play Console)

- Content rating (IARC): **17+ / Adults Only** skill competitions - not casino.
- Declare real-money tournaments / paid entry where asked; no gambling framing.
- Permissions already declared: coarse/fine location (cash jurisdiction), camera/media (identity KYC for payouts, receipts/avatars).
- Replace `applicationId` `com.example.dama_mobile` with production id before upload.

## iOS (App Store Connect)

- Age rating **17+**; corporate Apple Developer account required for real-money gaming (Guideline 5.3).
- `NSLocationWhenInUseUsageDescription` documents cash regional enforcement only.
- `PrivacyInfo.xcprivacy` declares coarse/precise location for app functionality (cash jurisdiction), not tracking.
- `ITSAppUsesNonExemptEncryption` = false (standard HTTPS).
- Questionnaire: skill-based board tournaments; third-party payments (Chapa/Paddle); no casino language.

## Product gates (already in API)

Cash enroll / checkout / payout refuse until age, allowlist country, fresh locate, phone KYC (when flagged), and government-ID document KYC (when `require_document_kyc_for_payout`: ID front/back + selfie + legal name + document type; admin-approved) succeed. Fail closed from DB policy.

Community host trust / scammer protection (phone for paid create; government ID + wallet lock for guaranteed prizes; open-cup limits; badges): see `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.

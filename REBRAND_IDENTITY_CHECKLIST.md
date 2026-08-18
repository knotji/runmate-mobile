# Rebrand Identity and Upgrade Checklist

Status: WholeMate display name and artwork implemented; release validation pending
Baseline branch: `master`
Baseline commit: `fefdf61`

## Automated baseline - 2026-08-18

- Unit tests: 123 files, 612 tests passed.
- ESLint: passed.
- TypeScript and Vite production build: passed.
- Existing observation: Vite reports the `ionic-core-vendor` chunk above its default 500 kB warning threshold. This is a recorded optimization candidate, not a failed gate.
- Physical Samsung screenshots and on-device performance samples remain pending.

## WholeMate implementation checkpoint - 2026-08-18

- Capacitor, Android, web/PWA, widget, notifications, About, privacy/export, accessibility copy, share pictures, and local AI prompts now use `WholeMate`.
- Compatibility identifiers remain `com.runmate.mobile` and `runmate:*` where changing them would break upgrades or stored state.
- Unit tests: 125 files, 621 tests passed.
- ESLint and production web build passed; the existing Ionic chunk-size warning remains unchanged.
- Capacitor Android sync and `:app:assembleDebug` passed.
- AI function deployment, signed update-install validation, and tester distribution remain pending.

## Permanent Android identity

The rebrand must update the existing installed application. These identifiers are compatibility contracts and must not change:

| Contract | Locked value | Current source |
| --- | --- | --- |
| Capacitor app ID | `com.runmate.mobile` | `capacitor.config.ts` |
| Android application ID | `com.runmate.mobile` | `android/app/build.gradle` |
| Android namespace | `com.runmate.mobile` | `android/app/build.gradle` |
| Android package string | `com.runmate.mobile` | `android/app/src/main/res/values/strings.xml` |
| Native OAuth callback | `com.runmate.mobile://auth/callback` | `src/lib/googleAuth.ts` and `AndroidManifest.xml` |
| Native navigation protocol | `com.runmate.mobile:` | `src/lib/nativeNavigation.ts` |
| File-provider authority | `${applicationId}.fileprovider` | `AndroidManifest.xml` |
| Signing identity | Existing RunMate release key | ignored signing configuration / release environment |
| Firebase Android app | Existing `com.runmate.mobile` registration | ignored `google-services.json` |

Changing the display name must not require a new Firebase Android app, signing key, Health Connect declaration, Supabase account, or tester installation.

## Persistent compatibility names

The following names are internal compatibility identifiers. They may continue to say `runmate` after the visual rebrand:

- `runmate:*` localStorage and sessionStorage keys;
- `runmate-guidance` notification channel ID;
- native event names such as `runmate:navigate`;
- health-sync timestamps, startup caches, Coach history, sleep-window choices, strain check-ins, notification preferences, diagnostics, and primary-tab state;
- Kotlin/Java package paths under `com.runmate.mobile`;
- internal model versions such as `runmate-fitness-age-v1`;
- legacy routes and redirect contracts.

Renaming these identifiers provides no user-facing value and risks losing data or breaking upgrade behavior. User-visible labels attached to them may be changed independently.

## User-facing identity to change together

Do not partially ship the new brand. One coordinated build should update:

- Capacitor `appName`;
- Android `app_name` and `title_activity_main`;
- launcher icon and round/adaptive icon artwork;
- splash artwork and background treatment;
- in-app logo and brand name;
- Today Plan widget label and visible widget branding;
- notification channel name, notification titles, and user-visible notification copy;
- About, Privacy & Data, diagnostics, export, onboarding/login, accessibility labels, and empty-state brand references;
- share-picture brand mark;
- Firebase tester release notes and eventual store listing.

Internal filenames such as `ic_stat_runmate` or `runmate_splash` may remain when their rendered artwork and user-visible result are correct.

## Update-install acceptance

The renamed release is accepted only after installing it over the latest signed RunMate tester build and confirming:

- Android treats it as an update, not a second application;
- the authenticated session restores;
- Health Connect permissions and previously imported records remain available;
- local activity caches, sleep-window choices, notification preferences, Coach history/draft, selected Move state, and diagnostics remain readable;
- Supabase owner data, profile, meals, workouts, race goal, and plan history remain unchanged;
- OAuth returns through `com.runmate.mobile://auth/callback`;
- notifications and the Today Plan widget still open valid compatibility routes;
- rollback to the previous tester build is documented before distribution.

## Pre-release automated guard

`src/lib/appIdentityContract.test.ts` locks the permanent Capacitor/Android identity and OAuth contracts, and now also verifies the coordinated `WholeMate` display name in Capacitor, Android, HTML, and the PWA manifest.

## Still pending

- [x] Approve the final display name: `WholeMate`.
- [ ] Complete domain/social availability and formal Thai and target-market trademark clearance; preliminary exact-name web/store screening was completed on 2026-08-18.
- [x] Approve launcher, splash, in-app, notification, widget, and share-card artwork.
- [ ] Capture baseline screenshots from the current tester build.
- [ ] Record baseline startup/tab/refresh performance from the tester device.
- [ ] Tag or otherwise record the final pre-rebrand signed release.

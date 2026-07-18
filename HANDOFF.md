# RunMate Mobile Handoff

Last updated: 2026-07-18

## Current state

This repository is an Ionic React + TypeScript + Vite + Capacitor mobile client that uses the existing RunMate Supabase project. The first implemented slice is authentication plus a WHOOP-inspired Recovery dashboard.

The work is currently uncommitted on local branch `master`. The branch still points to the scaffold's single `Initial commit`; do not discard the working tree. Review `git status` before making changes.

## How to run

Use Vite directly:

```powershell
cd C:\Project\runmate-mobile
npm.cmd run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Do not rely on `npx ionic serve` with the currently available Ionic CLI. It rejects the `react-vite` project type. Production builds work through:

```powershell
npm.cmd run build
```

The ignored `.env` file must contain these keys:

```dotenv
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Never print, commit, or copy the values into documentation or chat.

## Google OAuth setup

The application code is implemented, but Google OAuth also requires external provider configuration before it can complete a real sign-in.

### Implemented in the repository

- `src/pages/LoginPage.tsx` renders `Continue With Google`, a loading state, and OAuth errors.
- `src/lib/googleAuth.ts` calls `supabase.auth.signInWithOAuth({ provider: "google" })`.
- Browser builds redirect back to `<current-origin>/login`, where the Supabase browser client restores the session.
- Native builds use `com.runmate.mobile://auth/callback`, open the provider in Capacitor Browser, and support both implicit access/refresh tokens and PKCE `code` exchange.
- `src/App.tsx` handles Capacitor `appUrlOpen` and cold-start `getLaunchUrl()` callbacks, then closes the external browser after the session is restored.
- `@capacitor/browser` is installed as a runtime dependency.

### Required Supabase and Google Cloud configuration

1. In Google Cloud, create/configure an OAuth web client.
2. Add the Supabase callback as an authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard -> Authentication -> Providers -> Google, enable Google and enter that client ID and client secret.
4. In Supabase Dashboard -> Authentication -> URL Configuration, add every actual app callback to the redirect allow list:
   - `http://localhost:5173/login` for local Vite development;
   - the deployed web origin followed by `/login`;
   - `com.runmate.mobile://auth/callback` for native Capacitor builds.

Do not commit the Google client secret. It belongs only in Google Cloud/Supabase provider configuration.

### Native project requirement

There are currently no `android/` or `ios/` platform directories in this repository. After creating a platform with `npx cap add android` or `npx cap add ios`, register the `com.runmate.mobile` custom URL scheme in the generated Android intent filter and iOS `CFBundleURLTypes`, then run `npx cap sync`. Until that platform-level scheme exists, web Google login can work, but a native browser callback cannot reopen the installed app.

## Implemented product flow

1. `src/App.tsx` checks the Supabase session and routes between `/login`, authenticated `/tabs/*` pages, and the `/sleep` drill-down.
2. `src/pages/LoginPage.tsx` provides email/password sign-in through `supabase.auth.signInWithPassword` and Google OAuth through `src/lib/googleAuth.ts`.
3. `src/pages/RecoveryPage.tsx` loads `buildCoachContextFromSupabase()` on mount and pull-to-refresh.
4. The Recovery dashboard is English-only and shows three primary dials:
   - Recovery
   - Strain
   - Sleep
5. Below the dial card, the page retains Nutrition Support, Training Guidance, and the Tonight/Tomorrow recovery plan.
6. Tapping the Sleep dial opens `/sleep`, a separate Sleep Details view for current and historical sleep records.
7. `src/components/MainTabs.tsx` provides the authenticated bottom navigation:
   - `/tabs/recovery`
   - `/tabs/activity`
8. `/tabs/activity` is a read-only Daily Activity view that defaults to today's records. It intentionally has no category chips because the page already focuses on a single day. A compact date navigator moves to the previous/next date that contains activity, the center date opens the calendar, and an inline `Current` button appears after the right arrow on historical dates. Date changes show a short loading transition. `/tabs/history` remains only as a compatibility redirect. Editing and deleting records are intentionally not part of this slice.
9. Workout and Strength rows open `/activity/workout/:id`, a read-only Workout Detail page with available metrics, exercises, coach notes, and provenance. Missing metrics remain absent rather than being synthesized.
10. Sleep rows open `/sleep?date=YYYY-MM-DD&from=activity`, preselect that historical night, and return to Activity. Opening Sleep Details from the Recovery dial still returns to Recovery.

Inside the blue dashboard card, show only the three dials. Do not add a headline, status pill, Sleep Need, weekly trend, or other copy inside that card unless the owner explicitly changes this decision.

## Important display decision

The internal Strain model uses the WHOOP-style nonlinear `0-21` scale. The Strain dial displays that raw `0-21` value directly (not normalized to `0-100`) so the number shown in the dial matches the `Today's Strain X/21` line lower on the page. The dial's progress ring still fills proportionally to `internalStrain / 21`, so the visual fill behavior is unchanged. Internal scoring, thresholds, and training guidance continue to use the original `0-21` value.

Earlier revisions of this page normalized the displayed Strain number to `0-100` (`internalStrain / 21 * 100`) so all three dials shared the same printed scale; that was reverted because it showed a number like `8/100` next to a `Today's Strain 1.7/21` line elsewhere on the same screen, which read as two different measurements of the same thing.

## Recovery model

The model is identified as `whoop_style_v1` in `src/lib/recoverySystem.ts`. It is inspired by WHOOP's public concepts but is not WHOOP's proprietary formula.

### Recovery: internal 0-100

- Uses latest HRV compared with the user's personal HRV baseline.
- Uses latest resting heart rate compared with the user's personal RHR baseline.
- Uses overnight respiratory rate compared with the user's personal baseline when available.
- Uses Sleep Performance as a supporting input.
- Uses up to 30 days of sleep records through `CoachContext.sleepBaseline30d`.
- Pain and illness apply safety caps even when other signals are strong.
- State can be `scored`, `pending`, `calibrating`, `unscorable`, or `stale`.
- Display zones follow the WHOOP-style ranges:
  - Green: 67-100
  - Yellow: 34-66
  - Red: 0-33

### Recovery data-freshness contract

Today's Recovery must be calculated from the sleep session that ended on the current morning/current physiological cycle. A session that began the previous evening and ended this morning belongs to today.

Do not silently reuse an older sleep record as today's score. This is a safety and product-trust requirement. The UI and model must distinguish these states:

- `Scored today`: a valid sleep session ended this morning and today's Recovery was calculated from it.
- `Pending`: today's sleep session exists but its metrics are not ready yet.
- `Calibrating`: today's sleep is available, but the personal baseline does not yet contain enough nights.
- `Unscorable`: no usable sleep metrics exist for today's cycle.
- `Stale`: the most recent usable sleep belongs to an older date. It may be shown only as historical context with an explicit age/date label such as `Last available yesterday`; it must not be presented as Today's Recovery.

The intended evaluation order is:

```text
Find the sleep session that ended this morning
  -> if pending, show Pending
  -> if missing/unusable, show Unscorable
  -> if present, compare it with the preceding baseline nights
  -> if baseline is insufficient, show Calibrating
  -> otherwise publish Scored today
```

Baseline calculation must exclude the current sleep session. Strain continues to accumulate from today's activities, while Sleep Need and bedtime may update as today's Strain changes.

The current implementation enforces this contract in `recoverySystem.ts`: stale sleep produces `scoreState: "stale"`, Recovery and Sleep dials render `—`, and historical records remain available only in the separate Sleep Details view. `Pending` is reserved in the type model but cannot currently be detected because `history_items` contains completed imports rather than an upstream pending-score state.

### Strain: internal 0-21

- Nonlinear accumulation implemented with an exponential curve.
- Uses today's recorded workout duration, workout type, average HR, resting HR, and profile max HR when available.
- Falls back to type-based effort estimates when HR data is absent.
- It is explicitly an estimate because the mobile data currently lacks continuous heart-rate samples and complete muscular-load measurements.
- Weekly sessions and distance are context only. They do not directly increase today's Strain.

### Sleep Performance: internal 0-100

- Sleep Need is built from personal baseline sleep, recent sleep debt, and today's Strain adjustment.
- Available components are sleep sufficiency, sleep/wake-time consistency, sleep efficiency, imported sleep quality, and restorative sleep-stage balance when those fields are present.
- The model derives a typical wake time from up to 30 days of history, subtracts Sleep Need, and recommends an in-bed time 20 minutes before the target sleep time.
- If historical wake times are unavailable, the UI asks for a consistent wake time rather than inventing a bedtime.
- It remains an estimate because the source data does not currently provide complete continuous sleep stress, skin temperature, or SpO2 inputs.

### Fuel

- Fuel is a Nutrition Support insight, not a fourth readiness score.
- Meal, carbohydrate, and protein data may change the nutrition copy.
- Fuel must not increase or decrease the Recovery score.

## Sleep Details

`src/pages/SleepDetailPage.tsx` is the dedicated drill-down view opened by tapping the Sleep dial.

### Night navigation

- The latest available sleep record is selected initially.
- Left and right arrows navigate through every deduped sleep record currently loaded for the account; the UI is not limited to seven nights.
- Tapping the displayed date opens an Ionic calendar.
- Only dates that contain a sleep record are enabled.
- Selecting a date immediately switches to that night and closes the calendar; there is no separate confirmation button.
- Arrow navigation shows a short `Loading Night` / `Updating…` transition and disables repeated input while switching.
- When viewing an older night, an inline `Current` action appears after the right arrow and returns to the latest available record.
- Older nights are explicitly labeled `Historical`; they must never replace Today's Recovery.

The history view uses `CoachContext.sleepHistory`, containing all deduped sleep records returned by the current history loader. Recovery calculations remain isolated to `CoachContext.sleepBaseline30d`, so exposing older records does not extend or change the 30-day physiological baseline. The shared history loader currently caps the combined result at 2,000 records for performance.

### Selected-night content

- Sleep Score
- Sleep Duration
- Time In Bed
- Sleep Efficiency
- Sleep Stages: Awake, REM, Light, and Deep
- A proportional stage-distribution bar and per-stage durations
- Data Coverage for duration, time in bed, HRV, resting heart rate, respiratory rate, stages, and schedule
- Validation warnings for missing data, insufficient baseline, stale latest data, and future-dated records

If stage data or another signal is absent, the UI says it is unavailable. It must not fabricate or estimate missing source values.

## Ported source and architecture

The Recovery and data layer were ported from `C:\Project\runmate-ai\src` into `src/lib` and `src/types`. Key files:

- `src/lib/recoverySystem.ts`: WHOOP-inspired model and compatibility axes.
- `src/lib/recoveryLoop.ts`: day load, sleep need, and tomorrow-preview helpers retained from RunMate.
- `src/lib/readinessV2.ts`: original readiness helper retained for compatibility.
- `src/lib/buildCoachContext.ts`: builds the complete context from Supabase records.
- `src/lib/supabaseClient.ts`: browser-only Supabase client.
- `src/pages/RecoveryPage.tsx`: visible dashboard and English guidance.
- `src/pages/RecoveryPage.css`: current visual system and responsive layout.
- `src/pages/SleepDetailPage.tsx`: current/historical night navigation, metrics, stages, freshness, coverage, and validation.
- `src/pages/SleepDetailPage.css`: compact date navigator, calendar modal, metric/stage cards, and mobile layouts.
- `src/lib/sleepDiagnostics.ts`: selected-night coverage and date-validation diagnostics for real account data.
- `src/components/MainTabs.tsx`: authenticated Recovery/Activity bottom-tab shell.
- `src/pages/ActivityPage.tsx`: implementation of the read-only Daily Activity view built from `loadHistoryItems()`.
- `src/pages/ActivityPage.css`: date navigation, daily record summaries, and mobile states.
- Activity rows include an explicit delete action. Deletion requires confirmation, preserves the selected date, updates local state only after Supabase succeeds, and retains the record with a dismissible error if deletion fails.
- `src/pages/WorkoutDetailPage.tsx`: Workout/Strength record loading and truthful detail presentation.
- `src/pages/WorkoutDetailPage.css`: workout hero, metric grid, exercises, and coach-note layout.
- `src/lib/workoutDetail.ts`: pure Workout/Strength record-to-view-model mapping; omits unavailable metrics.
- `src/pages/MealDetailPage.tsx`: read-only meal record view with foods, available nutrition values, guidance, and notes. `What Was Logged` uses the same `Food | Quantity | Unit | Portion` line format as Upload review in a read-only textarea.
- `src/pages/HealthDetailPage.tsx`: combined Pain/Sick record view with adaptive safety flags, symptoms, training guidance, and a selectable Health Timeline.
- `src/pages/RecordDetailPage.css`: shared visual layout for Meal and Health child views.
- `src/components/RecordDetailSections.tsx`: shared detail states, metric grids, and notes.
- `src/lib/activityDetails.ts`: pure Meal/Pain/Sick record-to-view-model mapping; unavailable values are omitted.
- `src/pages/UploadPage.tsx`: Mobile-owned Meal photo upload, editable preview, confirmation, and history persistence flow.
- `src/lib/mealUpload.ts`: client image resizing and authenticated Supabase Function invocation.
- `src/components/WorkoutUploadFlow.tsx`: multi-screenshot Workout upload, editable metric/date/type review, save, reset, and Workout Detail navigation.
- `src/lib/workoutUpload.ts`: authenticated Workout analysis invocation using the shared image preparation guard.
- `supabase/functions/analyze-workout/index.ts`: authenticated Gemini Workout screenshot analysis with Thai coaching text and honest nullable metrics.
- `src/components/SleepUploadFlow.tsx`: multi-screenshot Sleep upload, explicit night-date confirmation, editable trustworthy-signal review, save/reset, and Sleep Detail navigation.
- `src/lib/sleepUpload.ts`: authenticated Sleep analysis invocation using shared image preparation.
- `supabase/functions/analyze-sleep/index.ts`: authenticated Gemini Sleep screenshot extraction that leaves unavailable physiological signals null and does not calculate Recovery or Readiness.
- `supabase/functions/analyze-meal/index.ts`: authenticated Gemini meal-image analysis; AI secrets remain server-side.

The `analyze-meal` Edge Function is deployed to the Supabase project. `GEMINI_API_KEY` is configured as a Supabase secret (never expose it through `VITE_*`). An unauthenticated live request was verified to return HTTP 401. Use an authenticated mobile session for end-to-end image verification.

Meal analysis keeps its JSON keys and enum values in English for schema compatibility, while detected food names, portions, hydration guidance, coach guidance, and uncertainty descriptions are requested in Thai.

Meal Upload accepts 1-4 photos for one meal. The client resizes every image, enforces a combined payload guard, and the Edge Function analyzes all views together while avoiding duplicate counting across angles.

Meal Upload defaults its Meal Type from the current Bangkok time: Breakfast 05:00-10:59, Lunch 11:00-15:59, Dinner 16:00-21:59, and Snack 22:00-04:59. The selection remains editable before analysis.

The port must remain browser-safe. The copied set was audited to contain no `next/`, `"use server"`, service-role client, or Supabase admin usage.

The web app's background AI profile-sync hook was intentionally removed from the mobile `cloudHistory.ts`. That flow calls a Next.js API and is outside this client-only slice.

## UI decisions

- All visible UI text is English.
- Headings and labels use spaced Title Case, for example `Training Guidance`, `Sleep Duration`, and `Data Coverage`. Descriptive sentences remain sentence case. Do not use no-space programming-style camelCase in visible text.
- The page uses a cool blue/white visual system.
- The three dials are the clear focal point.
- The blue dial card contains only the three circles.
- Supporting content uses lighter cards and more whitespace.
- The layout is optimized for narrow mobile screens and becomes two columns for the Tonight/Tomorrow cards on wider screens.
- Keep accessibility labels on controls and dial graphics.
- Keep primary destinations in the bottom tab bar. Sleep Details remains a full-screen child view so its date navigation is not crowded by a second navigation layer.

Internal legacy helpers still contain Thai reason strings because they came from RunMate AI. They are not currently rendered by the English Recovery UI. If a future screen exposes raw model reasons, translate them at the presentation boundary or migrate the model strings deliberately; do not accidentally display mixed-language output.

## Verification status

The latest successful checks were:

```powershell
npm.cmd run lint
npm.cmd run test.unit -- --run
npm.cmd run build
git diff --check
```

Results:

- ESLint: passed with 0 errors.
- Vitest: 4 files, 12 tests passed.
- TypeScript and Vite production build: passed.
- `git diff --check`: passed.
- Visible `.tsx`, `.css`, and Cypress text was audited for Thai text and common mojibake sequences.
- Vite reports only a bundle-size warning; it does not fail the build.

`cypress/e2e/auth.cy.ts` was updated for the English login screen. Cypress E2E has not been executed successfully on this machine because the Cypress 13.17.0 binary repeatedly failed to finish extracting into the local cache. A second installation attempt using the isolated cache `C:\Users\Jirayu\AppData\Local\Temp\runmate-cypress-cache` failed at the same `Unzipping Cypress 0%` point. The package is installed; the external binary/extraction environment is the blocker.

## Tests

`src/lib/recoverySystem.test.ts` covers:

- unscorable behavior when sleep data is missing;
- HRV/RHR personal-baseline scoring;
- nonlinear internal Strain staying within 0-21;
- Fuel not changing Recovery;
- pain safety behavior.
- personalized bedtime, target sleep time, target wake time, and sleep efficiency.
- scored-today, calibrating, stale, and unscorable freshness behavior.
- missing-signal coverage without fabricated values.

`src/lib/sleepDiagnostics.test.ts` covers:

- missing coverage without fabricated values;
- selected historical nights using their own duration and stage coverage rather than retaining the latest night's values.

`src/lib/activityDetails.test.ts` covers:

- structured Meal values without fabricating unavailable macros;
- Pain safety flags and training guidance;
- Sick symptoms, safety indicators, and rest guidance.
- resolved Pain status taking precedence over an older risk classification.

Activity rows now open dedicated child routes:

- Meal: `/activity/meal/:id`
- Pain and Sick: `/activity/health/:id`
- Workout and Strength: `/activity/workout/:id`
- Sleep: `/sleep?date=YYYY-MM-DD&from=activity`

When changing scoring, add or update tests without weakening these safety properties.

## Out of scope for this slice

- AI coach chat, insights, and race-plan generation.
- Server-side secret API calls.
- Sleep and Workout upload/import flows; only Meal Upload is implemented in the mobile app so far.
- Push notifications.
- Reproducing WHOOP's proprietary formula exactly.

## Recommended next steps

1. Visually verify the latest Recovery and Sleep Details views on at least a narrow mobile viewport and one wider viewport.
2. Sign in with a real RunMate account and use Sleep Details to inspect freshness, coverage, date navigation, sleep stages, baseline count, and the derived bedtime across several days.
3. Repair the Cypress binary extraction environment and run `npm.cmd run test.e2e`.
4. Add continuous HR/HR-zone samples if a future import or wearable integration exposes them; current Strain is an honest estimate from workout summaries.
5. Add skin temperature and SpO2 only when the source schema and import pipeline retain trustworthy values.
6. Decide whether to persist a longer dedicated physiological baseline instead of deriving it from available history records at read time.
7. Commit the current working tree only after reviewing the entire port because nearly all implementation files are still untracked.
8. Verify Meal Upload end-to-end with 1-photo and 4-photo signed-in examples.
9. Reuse the Mobile Upload shell and authenticated Edge Function pattern for Workout Upload, then Sleep Upload.

## Latest Meal Upload Work

The mobile app now owns its Meal Upload flow rather than calling the RunMate AI Next.js API.

### User Flow

1. Open the center `Upload` tab.
2. Confirm or change the automatically selected Meal Time.
3. Add 1-4 photos of the same meal.
4. Optionally add context about portions or shared dishes.
5. Select `Review Meal` and wait for analysis.
6. Review and edit detected food names, Calories, Protein, Carbs, and Fat.
   The Food editor is a lightweight textarea with one food per line using `Food | Quantity | Unit | Portion`. Quantity, unit, and qualitative portion are optional. Users add a line for missing food or delete a line to remove an incorrect detection; blank lines are removed before saving.
7. Select `Save Meal` to persist the record to `history_items` and open Meal Detail.

After a successful save, the cached Ionic Upload tab resets its photos, analysis result, note, errors, loading state, and saving state before navigation. Returning to Upload therefore starts a fresh Meal entry with Meal Time inferred again from the current Bangkok time.

### Meal Time Defaults

Meal Time is inferred from the current `Asia/Bangkok` time whenever Upload first opens:

- Breakfast: 05:00-10:59
- Lunch: 11:00-15:59
- Dinner: 16:00-21:59
- Snack: 22:00-04:59

The inferred selection is only a default and remains editable before analysis.

Meal Date defaults to the current Bangkok date but can be changed to any past date both before analysis and during Review. Future dates are blocked. Save uses that confirmed date for `dateKey`, `recordedAt`, and Meal Detail/Activity history placement.

### Multi-Photo Behavior

- One Meal may contain 1-4 photos.
- Selected photos appear in a compact thumbnail grid and can be removed individually.
- The client resizes every photo before upload and rejects an oversized combined payload.
- All photos are analyzed together as one Meal.
- The analysis prompt instructs Gemini not to count the same food twice when multiple photos show different angles.
- The saved Meal retains `imageCount`, but raw image data and image previews are not persisted to history.

### AI Language And Security

- Detected food names, portions, units, hydration guidance, coach guidance, and uncertainty descriptions are requested in Thai.
- JSON property names and enum values remain English for schema compatibility.
- Analysis runs through the authenticated Supabase Edge Function at `supabase/functions/analyze-meal/index.ts`.
- The function verifies the Supabase user before calling Gemini.
- `GEMINI_API_KEY` is stored only in Supabase Secrets and must never be exposed through a `VITE_*` variable.
- The Edge Function is deployed to the current Supabase project.
- A live unauthenticated request was verified to return HTTP 401.

### Latest Verification

After the multi-photo layout and analysis update:

- ESLint passed with zero errors.
- Vitest passed: 6 files, 21 tests.
- TypeScript and Vite production build passed.
- `git diff --check` passed.
- The Edge Function deployed successfully.

End-to-end analysis with real signed-in photos should still be checked manually on the target mobile/browser environment.

## Latest Workout Upload Work

- The Upload tab now provides `Meal | Workout` type selection.
- Workout accepts 1-4 screenshots from the same session and shares the client resize/combined-payload safeguards used by Meal Upload.
- The authenticated `analyze-workout` Supabase Edge Function combines visible metrics without fabricating unavailable values.
- AI coaching and uncertainty text are requested in Thai; schema keys and workout enums remain English.
- Review supports editing Workout Type, Workout Date, Distance, Duration, Average Pace, Average HR, Max HR, and Calories.
- Save persists a standard `workout` history item with the selected Bangkok date, resets cached Upload state, and opens Workout Detail.
- `analyze-workout` is deployed, and a live unauthenticated request was verified to return HTTP 401.
- ESLint, 22 unit tests, TypeScript/Vite build, and `git diff --check` passed after implementation.
- A real signed-in multi-screenshot workout analysis still needs manual end-to-end verification.

## Latest Sleep Upload Work

- The Upload selector now provides `Meal | Workout | Sleep`.
- Sleep accepts 1-4 screenshots from one night and uses the shared resize and combined-payload guards.
- Review requires explicit Night Date confirmation and allows editing only extracted values before save.
- Supported review fields include Sleep Duration, Time In Bed, Sleep Score, HRV, Resting HR, Respiratory Rate, and Awake/REM/Light/Deep stage minutes.
- Missing signals stay blank/null. The Edge Function prompt explicitly prohibits estimating physiological values and prohibits calculating Recovery or Readiness.
- Save persists a standard `sleep` history record for the confirmed date, resets cached Upload state, and opens Sleep Detail for that night.
- `analyze-sleep` is deployed, and a live unauthenticated request was verified to return HTTP 401.
- ESLint, 22 unit tests, TypeScript/Vite build, and `git diff --check` passed after implementation.
- A real signed-in multi-screenshot sleep analysis still needs manual end-to-end verification, including freshness and stage mapping.

Sleep extraction was hardened after a real review returned all-empty fields: Sleep/Workout screenshots now retain 1920px at 0.9 JPEG quality, numeric strings are accepted safely, common HRV/RHR/stage aliases are normalized, and duration text is derived only from extracted duration minutes. If no trustworthy sleep signal is readable, the Edge Function returns an error instead of opening an empty Review screen. The hardened `analyze-sleep` function is deployed.

When Sleep Duration and Awake time are both extracted but Time In Bed is absent, Time In Bed is transparently derived as their sum and labeled in Review. HRV, RHR, and Respiratory Rate are never derived. Review also warns when REM + Light + Deep differs from extracted Sleep Duration by more than 20 minutes.

Sleep screenshot analysis now uses `gemini-3.1-flash-lite` by default and a section-by-section transcription prompt. It distinguishes Sleep Score from Energy Score, cross-checks duplicate values across images, supports common response aliases, and captures sleep latency, average/lowest SpO2, and skin-temperature change when explicitly visible. Conflicting or unreadable values remain blank and are flagged for review rather than guessed.

Before Sleep or Workout screenshots are sent for analysis, very tall screenshots are split into up to four overlapping vertical tiles across the selected files. This preserves readable label/value text instead of shrinking an entire long Samsung Health screenshot to a narrow image. Meal image preparation keeps its existing behavior.

Workout Review exposes cadence, elevation gain, VO2 Max, and estimated sweat loss in addition to the original core fields. Samsung pace notation such as `05'54"` is normalized to `5:54/km` before review and saving.

Workout metrics from multiple screenshots are merged when their labels are explicit. For example, `Max. heart rate 187 bpm` in a secondary Samsung Workout Details screenshot is a trustworthy Max HR value and must be preserved; an HR-zone boundary alone must not be treated as Max HR.

Swimming is a first-class Workout type. Pool Swim Review and Detail use meters and `/100 m` pace, and support pool length, total lengths, total strokes, average/best SWOLF, average speed, average/max HR, calories, and duration. Do not convert swim pace to `/km` or label a recognized swim as Other.

Circuit, Weight, Strength, and Resistance Training are classified as Strength workouts. Review captures the visible workout name and shows only duration, average/max HR, and calories by default; run-only distance, pace, cadence, elevation, VO2 Max, and sweat-loss inputs stay out of the Strength review.

Run and Treadmill Review also supports explicitly labeled average/max speed, max pace, steps, and max cadence. Samsung average and max pace strings are normalized to `m:ss/km`. These metrics are preserved into Workout Detail rather than discarded after Review.

Sleep Review also performs a deterministic reconciliation when the AI copies Time In Bed into Sleep Duration. If REM + Light + Deep plus Awake matches Time In Bed within five minutes, the non-awake stage total becomes Actual Sleep Duration, the displayed duration is corrected, and the result is marked for review. Values are not changed when those independent metrics do not reconcile.

Upload type order is `Sleep | Workout | Meal`. The automatic default follows today's Bangkok workflow: before noon with no sleep it opens Sleep; after a Sleep record it opens Workout; after a Workout/Strength record it opens Meal. Outside the morning window with neither record it defaults to Meal. Users can always switch manually.

All Upload date controls render as `dd/MM/yyyy` while retaining ISO `YYYY-MM-DD` internally for browser inputs, Supabase persistence, routing, and date comparisons.

## Android Build

- Capacitor Android was added and synced under `android/` with app id `com.runmate.mobile`.
- The local Android toolchain uses JDK 21, Android SDK Platform 36, and Android Build Tools 35/36.
- Create fresh web assets with `npm.cmd run build`, then sync them with `npx.cmd cap sync android`.
- Build a debug APK from `android/` with `.\gradlew.bat assembleDebug` after setting `JAVA_HOME` and `ANDROID_HOME`.
- The verified debug artifact is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
- This is a development APK signed with the Android debug certificate; a separately signed release build is still required for Play Store distribution.
- Native Google OAuth returns through `com.runmate.mobile://auth/callback`. Android registers this URI on `MainActivity` with a browsable `VIEW` intent filter, while `App.tsx` exchanges the callback session and closes the system browser.
- Supabase Authentication URL Configuration must also allow the exact redirect URL `com.runmate.mobile://auth/callback`. Google Cloud continues to use the Supabase callback URL; the custom mobile URI does not belong in Google Cloud Authorized Redirect URIs.

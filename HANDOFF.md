# RunMate Mobile Handoff

Last updated: 2026-07-20

Before changing layout, typography, cards, or user-facing wording, read
[`UI_GUIDELINES.md`](./UI_GUIDELINES.md). It is the shared app-wide standard for
page hierarchy, font sizes, text case, spacing, and responsive review.

## Current state

This repository is an Ionic React + TypeScript + Vite + Capacitor mobile client that uses the existing RunMate Supabase project. The first implemented slice is authentication plus a WHOOP-inspired Recovery dashboard.

The maintained branch is `master`. Review `git status` before making changes and preserve any unrelated local work.

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

The Android platform exists under `android/` and registers `com.runmate.mobile://auth/callback` so Google OAuth can reopen the installed app. Run `npx cap sync android` after changing web code or Capacitor configuration. An iOS platform has not been added yet; when it is added, register the same callback through `CFBundleURLTypes` before testing native OAuth.

## Implemented product flow

1. `src/App.tsx` checks the Supabase session and routes between `/login`, authenticated `/tabs/*` pages, and the `/sleep` drill-down.
2. `src/pages/LoginPage.tsx` provides email/password sign-in through `supabase.auth.signInWithPassword` and Google OAuth through `src/lib/googleAuth.ts`.
3. `src/pages/RecoveryPage.tsx` loads `buildCoachContextFromSupabase()` on mount and pull-to-refresh.
4. The Recovery dashboard is English-only and shows three primary dials:
   - Recovery
   - Strain
   - Sleep
5. Below the dial card, the page shows a horizontal Daily Support carousel, Training Guidance, and the Tonight/Tomorrow recovery plan.
6. Tapping the Sleep dial opens `/sleep`, a separate Sleep Details view for current and historical sleep records.
7. `src/components/MainTabs.tsx` provides the authenticated bottom navigation:
   - `/tabs/recovery`
   - `/tabs/upload`
   - `/tabs/activity`
   - `/tabs/more`
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

## Daily Support Carousel

`src/lib/recoverySupport.ts` converts existing Recovery context into concise support cards without changing Recovery, Strain, Sleep, or Fuel calculations.

- Cards display one at a time at full container width and use horizontal scroll snapping.
- Position dots show the selected card when more than one card is available.
- Priority is Body Alert, Fuel Support, Hydration Support, then Data Coverage; at most three cards are shown.
- Body Alert appears only when a Pain or Sick record is active.
- Fuel Support appears only when logged nutrition indicates `low` or `top_up`.
- Hydration Support is always available. Because no structured hydration total exists, its low-Strain copy is explicitly a general reminder and never claims the user is dehydrated.
- Data Coverage is always available and changes to Data Alert for stale/unscorable Recovery or missing Meal data.
- Recovery freshness and calibration warnings were removed from Training Guidance because the carousel now owns those messages, avoiding duplicate warnings on the same screen.
- `src/lib/recoverySupport.test.ts` covers the calm-state cards, missing-Recovery behavior, and the three-card priority limit.

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
- Vitest: 9 files, 33 tests passed.
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

## Product Roadmap Priority

When extending the mobile app with more data and functionality from RunMate AI, use this order:

1. **Today's Training Plan** — Highest-value next step because it turns the Recovery score into a clear action for the user. Show the planned workout, duration or distance, target intensity, and why the plan fits today's Recovery.
2. **Race Goal** — Bring over race date, distance, target finish time, and weeks remaining.
3. **Weekly Training Summary** — Show total distance, session count, plan adherence, and training-load trend without duplicating the daily Recovery view.
4. **Profile / Settings** — Support Max HR, preferred wake time, timezone, and training preferences needed by personalized calculations and guidance.
5. **Notifications** — Add bedtime guidance, missing-sleep reminders, workout reminders, and meaningful Recovery alerts after the underlying settings and plans are available.

Prefer a concise Today's Training Plan over porting the full Coach chat first. The plan gives the Recovery screen one direct next action while avoiding guidance duplicated across multiple sections.

### Step 1 implemented: Today's Training Plan card

- `src/lib/todayTrainingPlan.ts` ports `getTodayPlannedWorkout()` (date match → weekday-label match → `planStartDate` offset, mirroring runmate-ai's `todayPlanning.ts`) plus new `getTodayTrainingPlanStatus()` and `buildTodayTrainingPlanGuidance()`.
- `src/components/TodayTrainingPlanCard.tsx` renders on `RecoveryPage` directly below the three dials as a compact action card (`min-height: 88px`) rather than a full section.
- `translatePlanFieldToEnglish()` translates common Thai tokens in `targetPace`/`targetHR` (e.g. "โซน" → "Zone", "ไม่เกิน" → "Max") at the presentation boundary, since those fields come from runmate-ai's Thai-first plan generator but the mobile UI is English-only.
- **Guidance must not duplicate Training Guidance**: when a workout is planned for today, the Training Plan card is the only training action shown and the separate `TrainingGuidance` section is hidden. When no plan exists, `TrainingGuidance` becomes the fallback. `buildTodayTrainingPlanGuidance()` only adds session-specific action text (scale back / keep controlled) for moderate/low Recovery, and a not-yet-scored note when Recovery has no score.
- **Card has 4 states**, driven by `getTodayTrainingPlanStatus()` which returns `'pending' | 'completed' | 'logged_different'`:
  1. No active race goal/plan → "No Active Plan" empty state.
  2. `pending` (plan exists, nothing logged today yet) → planned session name, metrics (distance/pace/HR), and the guidance line above.
  3. `completed` (something logged today matches the planned workout type) → green-tinted card, title shows the actual logged workout's name.
  4. `logged_different` (something WAS logged today, but it doesn't match the planned type — e.g. plan said Easy Run, user logged Strength) → amber-tinted card (`--dial-color` of the Strain dial, `#ffd26f`), title shows the actual logged workout's name, body explains the mismatch. This state must stay distinct from `pending` — silently showing "still to do" on a day the user already trained differently would be misleading. Originally ported from runmate-ai's `checkPlannedWorkoutMatching()` `isUncertain` case, which was dropped during the initial port and had to be added back.
- **Title reflects what was actually logged, not just the plan**: for `completed`/`logged_different`, the card's bold title is `context.todayPrimaryWorkout.label`, not `planned.workoutType` — only the `pending` state shows the planned name as the title. This required fixing `todayWorkouts[].label` in `buildCoachContext.ts`, which previously came from `workoutKindLabel()` — a generic Thai string (e.g. "เวทเทรนนิ่ง") that ignored the AI-detected `extracted.workoutName` (e.g. "Weight machines") entirely and violated the English-only UI rule. New `englishWorkoutLabel()` prefers `workoutName` and falls back to an English kind label; `workoutKindLabel()` was removed since nothing else called it.
- Tests in `src/lib/todayTrainingPlan.test.ts` (16 cases) cover all three matching strategies, all three completion statuses, guidance-by-zone, translation, and half-minute pace formatting.

## More And Race Goal

- `More` is the fourth authenticated tab and keeps long-term planning/settings out of the daily Recovery screen. Race Goal and the read-only Health Data Test are available; Profile & Settings and Notifications remain visibly marked `Planned`. Sign Out lives in More.
- More typography is intentionally compact: 21-23px page heading, 13px menu titles, 11px summaries, 38px icons, and 72px minimum menu rows.
- `/race-goal` supports one active race goal, Create/Edit, profile-derived longest-run refresh, target time/pace, countdown, training-build progress, the next seven sessions, a separate Refresh Plan action, and completed-race history.
- Create/Edit and Refresh invoke the deployed `generate-race-plan` Supabase Edge Function. It uses `gemini-3.1-flash-lite` when configured and a conservative deterministic fallback when AI is unavailable.
- Pace boundaries are constrained to 30-second increments ending in `:00` or `:30`. The function prompt requires this and server normalization enforces it; the presentation layer also normalizes older saved plans.
- Rest and Recovery rows never show meaningless `0 km`, `0 min`, or `N/A`: Rest renders `Rest Day`, while timed Recovery renders `<duration> min · Easy Recovery`.
- Every weekly session row opens a Session Details sheet. It displays only relevant metrics plus the saved plan's description, purpose, and adjustment guidance. Opening details does not call AI again, so guidance stays consistent with the generated plan and works with deterministic fallback plans.
- `generate-race-plan` is deployed. Any future function change must be redeployed before mobile clients can receive the new behavior.

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

## Recent Fixes

### AI coach message missing for uploaded Strength workouts

Two separate bugs combined to make an uploaded Strength workout (e.g. "Weight machines") show no AI coaching text at all in Workout Detail:

1. **Client rendering**: `buildWorkoutDetail()` in `src/lib/workoutDetail.ts` only read `data.notes`/`data.coachReason` for Strength items — fields that belong to the saved-routine/AI-prescription flow (`src/types/strength.ts`). Workouts uploaded from a screenshot always carry their AI text under `data.coach.*` (`workoutSummary`, `coachNote`, etc.) regardless of workout kind, and that path was never read for Strength. Fixed: the Strength branch now reads both sources, so `insights` shows Summary/Intensity/Training Load/Recovery/Nutrition/Next Workout for AI-analyzed uploads in addition to Notes/Coach Note for template-based logs. Covered by a new test in `src/pages/WorkoutDetailPage.test.ts`.
2. **AI prompt**: even after the rendering fix, a real screenshot with only session-level metrics (duration, calories, HR — no exercise list) came back from Gemini with every `coach.*` field as an empty string, confirmed by inspecting the live `analyze-workout` response body. The prompt in `supabase/functions/analyze-workout/index.ts` now explicitly requires `coach.workoutSummary` and `coach.coachNote` to never be empty, even with only session-level metrics, while still prohibiting the AI from inventing exercises it can't see. Redeployed with `supabase functions deploy analyze-workout --project-ref frczilqwvlketeplafoi` (project `runmate-ai`).

### Activity and Recovery tabs went stale after switching tabs

`ActivityPage` and `RecoveryPage` each loaded their data once in a plain `useEffect` on mount. Ionic's `IonTabs`/`IonRouterOutlet` keeps tab pages alive instead of remounting them on tab switch, so a workout/meal/sleep saved elsewhere never appeared until a manual pull-to-refresh. Fixed by adding Ionic's `useIonViewWillEnter()` lifecycle hook alongside the existing `useEffect` in both pages — it fires every time the tab becomes active again, not just on first mount.

### Recovery Plan "Tomorrow" tile duplicated Training Guidance and ignored staleness

`RecoveryPlan`'s Tomorrow tile in `RecoveryPage.tsx` computed its own headline/summary straight from `recovery.overallScore`, independent of `TrainingGuidance`. Two problems:

1. **Duplicate copy**: for the 34-66 and <34 score bands, the headline text was word-for-word identical to `TrainingGuidance`'s guardrail title ("Keep It Controlled", "Recovery First") — two cards on the same screen saying the same thing.
2. **No freshness gating**: `TrainingGuidance` skips itself entirely when `scoreState` is `'stale'` or `'unscorable'`, but the Tomorrow tile had no such check and would confidently render a score-based headline even while the Recovery dial right above it shows `—` for the same reason — a direct contradiction of the Recovery data-freshness contract documented above.

Fixed: Tomorrow's copy now focuses on what this tile actually controls — tonight's sleep — instead of restating overall Recovery status (e.g. "Hitting your Sleep Need tonight should hold this Recovery steady for tomorrow" instead of "Ready To Build"). It also gates on the same `scoreState === 'scored' || 'calibrating'` condition as the Recovery dial, falling back to a neutral "Focus On Tonight" message when Recovery isn't reliably scored.

### Recovery and Upload page font sizes rebalanced

Both pages had accumulated too many near-duplicate font sizes with awkward jumps between them:

- **RecoveryPage**: section headings (`Training Guidance`, `Recovery Plan`) were 21px, towering over the 13-17px card/item titles directly beneath them. Reduced to 18px. Dial numbers (`clamp(25px, 7vw, 35px)`) also nudged down slightly (`clamp(24px, 6.4vw, 32px)`) to soften the jump to the now-smaller headings.
- **UploadPage**: had 7 distinct sizes (25/17/16/11/10/9/8px) where several were only 1px apart and visually indistinguishable. Consolidated to 4 (25/16/11/9px) — all former 17px and 8px values merged into 16px/9px, all former 10px values merged into 11px.

### Sleep Window and tonight-only wake time

The Recovery Sleep Plan card is now a compact summary that opens `/sleep-window`. The dedicated page lets the user change tomorrow's wake time for tonight only, then immediately recalculates the recommended in-bed window and target asleep time from the current Sleep Need plus a 20-minute wind-down allowance. The override is stored under a Bangkok-date-scoped local-storage key, so it is reused when returning to Recovery but does not silently become the user's Profile wake time or carry into a later date. `Use Profile Time` clears the override.

`src/lib/sleepWindow.ts` owns clock parsing/formatting, date-scoped storage, and the calculation. The page also shows an explicitly estimated cycle range and a collapsed Sleep Cycle Detail explaining how early-, middle-, and late-night stage composition commonly differs. Cycle guidance uses an 80–100 minute range only for education; it does not force bedtime into fixed 90-minute blocks or claim to predict a measured Sleep Stage timeline. Completed measured stages remain on Sleep Details.

`Save For Tonight` now persists the selected wake time across devices through `public.sleep_window_plans`, keyed by `(user_id, target_date)` with `Asia/Bangkok` as the plan timezone. The table has RLS enabled and separate owner-only select/insert/update/delete policies. `src/lib/sleepWindowStorage.ts` loads the cloud value first with a date-scoped local fallback, distinguishes an unsynced local draft from a server-saved value, and upserts only after the explicit save action. `Use Profile Time` deletes tonight's cloud override as well as its local fallback. The migration source is `runmate-ai/supabase/migrations/020_sleep_window_plans.sql`; it was applied directly to Supabase through the linked Management API because the legacy remote migration history is not registered in the CLI migration table.

## Android Build

- The Android launcher icon and app name previously shipped as the default Capacitor placeholder (blue X mark, label `runmate-mobile`). Both are now branded:
  - `capacitor.config.ts` `appName` and `android/app/src/main/res/values/strings.xml` (`app_name`, `title_activity_main`) are `RunMate`.
  - The adaptive icon foreground/background and legacy `ic_launcher`/`ic_launcher_round` mipmaps were regenerated from the same pulse-logo design used by `public/icon-512.png` and `public/favicon.svg` (blue gradient background layer + white heartbeat-pulse foreground layer), replacing the unused default Capacitor teal-grid vector drawables.
  - After pulling this change, run `npx cap sync android` and rebuild (`.\gradlew.bat assembleDebug`) so the new icon/name land in the APK; Android caches launcher icons aggressively, so uninstall the previous debug install (or reboot/clear launcher cache) if the old icon still appears.
- Capacitor Android was added and synced under `android/` with app id `com.runmate.mobile`.
- The local Android toolchain uses JDK 21, Android SDK Platform 36, and Android Build Tools 35/36.
- A debug APK was distributed through Firebase App Distribution (project `runmate-mobile`, project number `276482893444`, Android app id `1:276482893444:android:5643c0971817db76a584d1`). Every new distribution must include `--testers "jirayuknot55@gmail.com"` so the owner receives access/notification; uploading a binary without `--testers` creates the release but does not distribute it. Uploading via `firebase-tools appdistribution:distribute` from a bash/MSYS shell on Windows fails with `'C:\Program' is not recognized...` because paths containing spaces (e.g. `JAVA_HOME`, `PATH` entries under `C:\Program Files\...`) get mis-quoted crossing into `cmd.exe`; running the same command from PowerShell works. `firebase-tools login`/`login:ci` also both require a real interactive TTY — run them from the user's own terminal once, not through an automated/non-interactive shell.
- Recommended PowerShell distribution command:

  ```powershell
  npx.cmd firebase-tools appdistribution:distribute "android\app\build\outputs\apk\debug\app-debug.apk" --app "1:276482893444:android:5643c0971817db76a584d1" --testers "jirayuknot55@gmail.com" --release-notes "Describe this build."
  ```
- Create fresh web assets with `npm.cmd run build`, then sync them with `npx.cmd cap sync android`.
- Build a debug APK from `android/` with `.\gradlew.bat assembleDebug` after setting `JAVA_HOME` and `ANDROID_HOME`.
- The verified debug artifact is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
- This is a development APK signed with the Android debug certificate; a separately signed release build is still required for Play Store distribution.
- Native Google OAuth returns through `com.runmate.mobile://auth/callback`. Android registers this URI on `MainActivity` with a browsable `VIEW` intent filter, while `App.tsx` exchanges the callback session and closes the system browser.
- Supabase Authentication URL Configuration must also allow the exact redirect URL `com.runmate.mobile://auth/callback`. Google Cloud continues to use the Supabase callback URL; the custom mobile URI does not belong in Google Cloud Authorized Redirect URIs.

## Wearable Data Research & Health Connect Spike

RunMate's Recovery/Strain/Sleep models are repeatedly documented above as *estimates* because the mobile app currently only has data the user manually uploads as a screenshot (analyzed by Gemini). Two paths were researched for pulling real continuous wearable data instead:

### Open Wearables (evaluated, not adopted)

[openwearables.io](https://openwearables.io/docs) is a self-hosted (MIT license, free), unified wearable-data hub — one normalized REST API + webhooks for Garmin, Polar, Suunto, Whoop, Strava, Fitbit, Oura, Ultrahuman, Apple Health, and Google Health Connect. Rejected for now because:

- It requires standing up and maintaining separate infrastructure (FastAPI + PostgreSQL + Redis + Celery via Docker Compose) beyond the current Supabase project.
- It only ships official SDKs for Flutter and React Native, not Ionic/Capacitor. The SDKs are thin wrappers around native HealthKit/Health Connect calls, so a Capacitor plugin *could* replicate the behavior, but there's no off-the-shelf one.
- Direct Garmin/Fitbit/Whoop integration would additionally require registering and getting approved for OAuth apps with each provider.

Conclusion: a good fit for data quality, but a disproportionately large infra + native-code investment for what it unlocks beyond Health Connect alone.

### Samsung Health → Health Connect → Capacitor (the practical path)

Samsung Health has synced its data into Android's system-level **Health Connect** store since app version 6.22.5 (Oct 2022). This means Samsung Health data can be read **without any Samsung partnership approval** — Samsung's own direct SDK ("Samsung Health Data SDK", the old one deprecated 2025-07-31) does require partnership approval for write access, but Health Connect read access does not. Apple HealthKit is the iOS equivalent, fed by Apple Watch and any third-party app that writes into it.

Chosen plugin: **`@capgo/capacitor-health`** — reads/writes Health Connect (Android 8.0+ / API 26+) and HealthKit (iOS 14+) through one TypeScript API (`isAvailable`, `requestAuthorization`, `checkAuthorization`, `readSamples`, `saveSample`, `queryWorkouts`, `queryAggregated`). Supports steps, distance, calories, heartRate, restingHeartRate, heartRateVariability, respiratoryRate, oxygenSaturation, vo2Max, sleep (with per-stage `SleepStage[]`: asleep/awake/rem/deep/light), blood pressure, blood glucose, body temperature/weight/height/fat, and `queryWorkouts` session data — covers essentially everything the Recovery model's "estimate" caveats are waiting on, except skin temperature specifically.

**Multi-source caveat**: Health Connect/HealthKit aggregate data from *every* app the user has connected (Samsung Health, Garmin Connect, Fitbit, etc. all at once). Each `HealthSample`/`Workout` carries `sourceName`/`sourceId`/`platformId`, but the plugin does **not** dedupe across sources itself — if a user has both Samsung Health and Garmin Connect connected, the same run or the same night's sleep can come back twice. RunMate already has this exact problem solved once for Samsung Health CSV import (`runmate-ai`'s `parseSamsungHealth.ts`: source filtering + same-exerciseType-same-minute dedup) and once for mobile sleep (`src/lib/sleepDedupe.ts`) — a Health Connect integration will need the same kind of source-aware dedup before writing into `history_items`, not treat every sample as independent.

### `HealthTestPage` spike (read-only, not wired into the app yet)

To inspect real values before committing to a mapping/dedup design, a standalone spike page was added — deliberately **not** connected to `buildCoachContext()`, `history_items`, or any Supabase write:

- `npm install @capgo/capacitor-health`, synced via `npx cap sync android`.
- `src/pages/HealthTestPage.tsx` + `.css`: buttons for `isAvailable`, `requestAuthorization` (steps/sleep/heartRate/restingHeartRate/heartRateVariability/respiratoryRate/oxygenSaturation/workouts, with `requestHistoryAccess: true`), `checkAuthorization`, `readSamples` per data type (7-day windows), and `queryWorkouts` (30-day window). Each result renders as raw JSON in a scrollable log so real device values can be eyeballed.
- Every result card has a `Copy` action that copies its formatted raw JSON (or error text), changes briefly to `Copied`, and shows an inline error if clipboard access fails. It uses the browser Clipboard API first and a hidden-textarea fallback for Android WebViews.
- Routed at `/health-test` in `App.tsx` (same pattern as `/race-goal` — requires `session`, redirects to `/login` otherwise) and reachable from the `More` tab (`src/pages/MorePage.tsx`) as "Health Data Test".
- `android/app/src/main/AndroidManifest.xml` gained `android.permission.health.READ_HEALTH_DATA_HISTORY` (lets Health Connect return more than ~30 days of history on supporting providers). The plugin's own manifest merges in every per-data-type `READ_*`/`WRITE_*` Health Connect permission automatically — nothing else to declare by hand.
- **`android/variables.gradle` `minSdkVersion` raised from 24 to 26.** This is a real, unavoidable product trade-off, not a build tweak: Health Connect requires Android 8.0 (API 26)+, so the app can no longer install on Android 7.0/7.1 devices. The build fails with a manifest-merger error (`uses-sdk:minSdkVersion 24 cannot be smaller than version 26`) without this change.
- Debug APK rebuilt successfully at `android/app/build/outputs/apk/debug/app-debug.apk` with the plugin included.

### Real-device verification results (2026-07-19)

Tested on a Samsung SM-S918B with Samsung Health, Google Fit, Fitbit, and Strava all connected to Health Connect on the same account — a worst-case multi-source setup.

**Steps — `queryAggregated` needs Bangkok-midnight-aligned buckets, then matches exactly.**

The first attempt used `startDate: daysAgo(7)` (i.e. "now minus 7 days"), which produced totals that did **not** match Samsung Health's own daily totals at all (off by up to 40% in either direction on some days). Cause: `queryAggregated`'s `'day'` buckets are 24h windows starting exactly at the given `startDate` — they are not snapped to local midnight — so `daysAgo()` offset every bucket by the current time-of-day and mixed two calendar days per bucket. Fixed with `bangkokMidnightDaysAgo()` in `HealthTestPage.tsx` (converts to Bangkok wall-clock date, takes UTC midnight of that date, then shifts back by the UTC+7 offset). After the fix, 5 of 6 full days matched Samsung Health's displayed step count exactly, one day was off by 1 step (immaterial, likely a sync-boundary rounding), and the current partial day differed only because it was queried at a different moment than the screenshot. **Any future aggregated query (steps, calories, distance, etc.) must use Bangkok-midnight-aligned bucket boundaries, never `now - N days`.**

**Sleep — raw `readSamples` matches Samsung Health exactly when the record actually comes from Samsung Health.**

Three consecutive nights' `sourceId: "com.sec.android.app.shealth"` sleep records matched Samsung Health's displayed start time, end time, and duration to the minute. However, on a night where Google Fit was also active, Health Connect returned a **second, shorter fragment** for the same night (e.g. Samsung Health: 22:37–03:54, 317 min, full stage data; Google Fit: 22:37–23:59, 82 min, same start instant but stops early) — same physical sleep event, not two separate naps (confirmed by the identical start timestamps), just two apps disagreeing on how long it lasted. This is a different shape of duplicate than steps/workouts: it is **not** an exact `(startDate, endDate, value)` match, so that dedup key does not catch it.

**Workouts — `queryWorkouts` duplicates are exact matches across sources, same as steps**, including N-way duplication (one session appeared under both Fitbit + Samsung Health; a separate "weightlifting" session appeared under Fitbit + Strava only, with no Samsung Health copy at all).

**Decision: filter to `sourceId === "com.sec.android.app.shealth"` only, for sleep and workouts.**

Rather than building general N-way/fuzzy dedup logic, sleep and workout records will be filtered to Samsung Health's own source before mapping into `history_items`; every other source's copy is discarded. Steps (and other simple sum types) keep using `queryAggregated` with Bangkok-aligned buckets and need no source filtering — Health Connect's own aggregation already produced numbers matching Samsung Health exactly without any client-side filtering.

**Known limitation of this decision**: a workout logged through an app that never syncs into Samsung Health (e.g. this account's Fitbit+Strava-only "weightlifting" session) will be silently excluded once this filter ships. Acceptable for a Samsung-Health-centric user base; revisit if RunMate mobile users commonly rely on a non-Samsung primary tracker.

### Workout metrics verification (2026-07-19): distance is solid, calories is a genuine gap, HR derivation works

A real workout (outdoor run + weight machines, both logged via Strava and surfaced through Samsung Health) was captured and compared field-by-field.

- **`totalDistance` (native, computed by the plugin itself) is accurate** — 510.00 m (Samsung Health entry) and 510.84 m (Strava entry) both matched Samsung Health's displayed "0.51 km" almost exactly, once the missing `distance`/`calories` read permissions were added to `READ_TYPES` (the plugin's own `aggregateWorkoutData()` needs those permissions to attach `totalDistance`/`totalEnergyBurned` to a workout — without them it silently returns a workout with neither field, no error).
- **A real bug was found in `HealthTestPage.tsx`'s own derivation code**, not the plugin: `deriveWorkoutMetrics()` summed every `distance` sample whose `startDate` fell inside `[workout.startDate, workout.endDate]` with no source filter. Because the Samsung Health and Strava copies of the same run started 623ms apart, the boundary check let the Strava-workout window sweep in *both* sources' distance samples (570.89 m Samsung + 510.00 m Strava own record = 1080.89 m), while the Samsung-workout window (starting later) only picked up its own — same underlying bug class as the steps/workout duplication documented above, just now manifesting inside a manual aggregation instead of a raw sample list. **Lesson for the mapping layer: prefer the workout's own native `totalDistance`/`totalEnergyBurned` field over manually summing overlapping raw samples; if manual derivation is ever necessary (e.g. for HR, which has no per-workout native field), filter to the preferred `sourceId` before aggregating, never after.**
- **maxHR/avgHR/minHR derived from `heartRate` samples worked correctly and agreed exactly across both duplicate workout entries** (144/160/109 avg/max/min for the run, 111/126/98 for the weight session) — heart rate isn't duplicated with diverging values the way distance is, so this derivation is safe to keep.
- **Calories (`totalEnergyBurned` native and manually-derived `caloriesKcal`) were `null` on every entry**, even with the correct read permission granted. Samsung Health's own displayed "272 Cal" for the weight session is never written to Health Connect as an `ActiveCaloriesBurnedRecord` for this account — this is a real, unfixable-from-RunMate's-side data gap for Strava-sourced-via-Samsung-Health workouts, not a bug in the query.

### Sync architecture design: no fixed-interval background sync is possible

While discussing what the real mapping/sync job would look like, a "sync every 5 minutes" assumption turned out to be infeasible on both platforms — this shapes the whole design, so it's captured here before any implementation starts:

- **Android**: `WorkManager` periodic work has a **hard minimum interval of 15 minutes** — no plugin or code can request more frequent periodic background execution than that, and Doze mode can defer it further when the device is idle.
- **iOS**: `BGAppRefreshTask` is **opportunistic** — the app can request background refresh, but iOS decides if/when it actually runs; there is no guaranteed interval at all, and gaps of several hours are normal.
- Capacitor has no first-party plugin for this; it would require a community background-task/background-fetch plugin wrapping the native APIs above, which still carry the same OS limits.

**Design conclusion**: build sync as "run whenever triggered," not "runs every N minutes." Valid triggers, from most to least reliable: (1) app foreground/resume (already wired via `useIonViewWillEnter` on Recovery/Activity), (2) manual pull-to-refresh (already exists), (3) best-effort periodic background task (15+ min on Android, unpredictable on iOS) as a bonus, not a guarantee.

A draft `runSyncCycle()` was sketched (not yet implemented) with these properties, all driven by the findings above:

- Filters to the preferred `sourceId` (`com.sec.android.app.shealth`) at the point samples are read, before any aggregation — not after — closing off the exact distance double-counting bug found this session.
- Tracks a `lastSyncedAt` cursor, advanced only after a full cycle succeeds, so a failed sync doesn't silently skip data.
- Treats **workouts as "closed" only once `endDate` is more than ~2 minutes in the past**, since Health Connect's `ExerciseSessionRecord` for an in-progress session may not exist (or may not be finalized) until the source app ends it — a workout spanning multiple 5-to-15-minute sync cycles must not be processed until it closes, then its *entire* duration's heart-rate samples are fetched in one pass (not stitched together from each incremental sync window) to compute maxHR/avgHR.
- Uses each record's `platformId` as an idempotency key for upserting into `history_items`, since the same workout/session can be seen again across multiple sync calls before or after it closes.
- Keeps steps/sleep on the separate Bangkok-aligned aggregate/raw-sample path already verified above; they don't need the same "wait for close" handling since they aren't session-shaped.

### Samsung Health Workout Sync implementation (2026-07-19)

- `src/lib/samsungWorkoutSync.ts` now imports closed Samsung Health workouts from Health Connect and persists them idempotently using `platformId`-derived IDs. Only `sourceId === "com.sec.android.app.shealth"` is accepted, and sessions ending less than two minutes ago are deferred.
- Native `totalDistance` and `totalEnergyBurned` are preferred. Pace is derived deterministically from native distance and duration. Average/max HR use only Samsung Health samples inside the complete workout window, and VO2 Max uses the nearest Samsung sample during or up to 30 minutes after the session; raw distance/calorie samples are never summed across sources.
- Running, Treadmill, Walking, Cycling, Swimming, Strength, and Other map into the existing Workout schema. Swimming retains meter distance and `/100 m` pace; unavailable metrics remain null.
- `src/lib/workoutDedupe.ts` reconciles Samsung sessions with same-day screenshot uploads using compatible workout kind, duration tolerance, and distance tolerance. Samsung supplies measured fields; uploads can fill AI coaching, VO2 Max, sweat loss, exercises, and any metric Health Connect did not expose.
- Activity shows one canonical row with `Samsung Health + Upload` provenance when both sources match. Workout Detail loads the reconciled record, so AI guidance from the screenshot remains visible. `buildCoachContext()` uses the same reconciliation to prevent duplicate Workout/Strain totals.
- Recovery and Activity trigger Sleep + Workout sync on Ionic view entry; pull-to-refresh and Health Connect's `Sync Now` use the same idempotent path.
- The Health Connect product page requests Workout, Heart Rate, Distance, and Calories access, displays Workout as `Automatic Sync`, and reports Sleep/Workout counts after syncing.
- Coverage: `samsungWorkoutSync.test.ts` verifies Run, Swim, and invalid intervals; `workoutDedupe.test.ts` verifies source-of-truth merging and protects distinct same-day sessions from accidental merging.
- Remaining real-device check: install the latest APK, choose `Update Access`, grant Workout/Heart Rate/Distance/Calories, run `Sync Now`, then compare Outdoor Run, Treadmill, Swimming, and Strength against Samsung Health screenshots.
- Health Connect has no Sweat Loss record type, and the plugin confirms Exercise metadata exposes only source/device/id. Sweat Loss therefore remains upload-derived when visible in a Samsung screenshot; it must not be estimated by the importer.
- Workout pagination is mandatory: `queryWorkouts()` can return an old first page plus a non-null `anchor`; sorting applies only to fetched records. `queryAllHealthConnectWorkouts()` now follows every anchor (bounded at 2,000), deduplicates by `platformId`, and sorts the complete result. Both the production importer and Developer Details `Query Workouts (30d, All Pages)` use it. Sync copy says `Processed`, not `Checked`, because idempotent upserts may revisit existing records.
### Workout Upload And Samsung Reconciliation

- Activity reconciles Samsung Health workouts with existing screenshot uploads instead of showing both records.
- Matching uses the Bangkok activity date plus start time when both sources provide it; otherwise it compares duration and distance.
- Legacy uploads labelled `Other` may match a typed Samsung workout when their duration/distance agree. This supports uploads created before Swim and Strength normalization was added.
- Samsung Health remains the source of truth for measured fields, while upload-only AI guidance and unavailable device fields are preserved in the merged detail.
- Source records remain stored independently for provenance; Activity and coaching consume one reconciled canonical record. Re-syncing is idempotent and does not create another visible session.

### Health Connect Sync Scope

- `Sync Now` on the Health Connect page performs a 30-day Sleep and Workout backfill.
- `Repair Last 30 Days` is a separate Workout-focused repair action. It re-reads every Samsung Workout and its in-session Heart Rate samples for the same 30-day window, then upserts the deterministic records so missing HR timelines can be filled without creating duplicate Activity rows.
- Workout sync accepts only records whose Health Connect source is `com.sec.android.app.shealth`. Strava and Google Fit records are intentionally excluded; a matching Manual Upload remains available when Samsung Health shows a workout internally but does not share it through Health Connect. The Health Connect page explains this provider boundary so a missing historical record is not mistaken for a failed repair.
- Connecting and granting access also performs the default 30-day backfill.
- Entering Recovery or Activity, and pull-to-refresh on either page, syncs only today's Bangkok-date records.
- Today's Sleep query starts at noon on the previous Bangkok day and then retains only sessions attributed to today's wake date. This captures overnight sleep without importing older nights.
- Initial Recovery/Activity loading uses only Ionic's view-entry trigger, avoiding the previous duplicate request from both React mount and Ionic view entry.
- Health Connect displays a Latest Sync summary after Connect or Sync Now: Added, Updated, Reconciled, Unchanged, and Failed. Added/Updated/Unchanged compare deterministic Samsung record IDs and semantic health fields while ignoring the changing import timestamp. Reconciled counts canonical Sleep/Workout sessions currently combining Samsung Health and Upload provenance.

### Weekly Training And Daily Nutrition Summaries (2026-07-19)

- Activity now shows a compact `Daily Meal Total` for the selected date whenever Meal records exist. Calories are the primary value, with Protein, Carbs, and Fat shown together below it.
- The nutrition card totals only meals logged on that date. Missing nutrition fields remain `—`; they are never converted into zero. Copy explicitly labels the result as logged data rather than a full-day dietary estimate.
- `src/lib/activityNutritionSummary.ts` owns the pure selected-date aggregation and has coverage for multiple meals, date filtering, and unavailable macros.
- More now links to `/weekly-summary`. The new Weekly Summary page combines the already-deduplicated 7-day Coach Context into Sessions, Running Distance, Active Time, Active Days, Average Sleep, Nights Logged, Meal Logs, per-logged-day nutrition averages, and Training Mix.
- Weekly Summary refreshes today's Samsung Sleep and Workout data before rebuilding the view. It does not invent historical Recovery averages, adherence, nutrition targets, or prior-week trends that are not currently available in the trusted context.
- `src/lib/weeklyTrainingSummary.ts` keeps weekly calculations separate from presentation and is unit-tested.
- Verification: TypeScript/Vite production build passed, ESLint passed, and all 77 unit tests passed. Browser-based visual inspection could not run in this environment because no browser surface was available; real-device layout remains the final visual QA step.
- Weekly Summary typography was subsequently rebalanced for mobile readability, and every app toolbar title now uses one shared viewport-centered rule. Back and Close actions reserve equal title space and remain independently clickable.
- Weekly Summary now follows the shared app type hierarchy more closely: Training Load is the single focal card, supporting cards use quieter elevation, essential helper copy is at least 9px, and the 390px layout has dedicated spacing and metric sizing.
- The weekly date window is strictly today plus the previous six Bangkok dates. Sessions, running distance, active time, active days, and Meal days are recalculated from records inside that window, preventing impossible output such as `8 / 7 Days Logged`.
- Sleep Window no longer labels the Recovery engine's learned wake time as a Profile value. The action now says `Use Typical Wake Time` because it is derived from recent Sleep records.
- Samsung Health Sleep start/end timestamps are converted from ISO instants into `Asia/Bangkok` wall-clock time before bedtime/wake consistency and the typical wake time are calculated. This fixes UTC values such as `9:27 PM` appearing as a suggested wake time when the actual Bangkok wake time is early morning.
- Final verification after these follow-ups: all 78 unit tests passed, ESLint passed, TypeScript/Vite production build passed, and `git diff --check` passed.

## HR Zone Research: WHOOP's Methodology

Researched how WHOOP computes its 5 heart-rate zones, as a reference for a possible future RunMate feature (per-workout time-in-zone breakdown). Nothing described here is implemented — this is design research only.

**WHOOP uses Heart Rate Reserve (HRR), a.k.a. the Karvonen method** (Martti Karvonen, 1950s) — not a simple percentage of max HR:

```text
Target HR = ((Max HR − Resting HR) × %Intensity) + Resting HR
```

Zones as % of HRR: Zone 1 40-60% (very light/active recovery), Zone 2 60-70% (light-moderate, aerobic base), Zone 3 70-80% (moderate, aerobic), Zone 4 80-90% (vigorous, anaerobic), Zone 5 90-100% (max effort). WHOOP's own workout-detail breakdown chart appears to add an unofficial 6th bucket below Zone 1 — labeled "restorative" in some WHOOP support copy, and likely what shows as "Zone 0" in the app — for time below the 40% HRR floor; no official source gives an exact threshold for it beyond "below Zone 1."

Key properties that make HRR more personalized than a flat max-HR percentage:

- Uses each user's own **Resting HR**, not just Max HR — a fitter user (lower RHR) gets proportionally wider zones.
- WHOOP **auto-adjusts Max HR** from the user's actual observed workout data over time rather than trusting a fixed age-based formula.
- Zones are **recalculated on a rolling basis** (WHOOP uses a rolling 14-day RHR baseline) so they track current fitness, not fitness from a year ago.
- A generic age-based Max HR formula (220 − age, or the more accurate Tanaka formula 208 − 0.7 × age) is only a fallback for users without enough observed data yet — WHOOP is explicit that this doesn't account for gender or individual genetics.

### RunMate's schema already anticipates this — most fields exist, the logic doesn't

Checked `src/types/profile.ts` and `src/lib/profileStorage.ts`: the profile schema already has almost every field this would need, unused so far:

```ts
maxHr?: number;
normalRestingHr?: number;
hrZoneMethod?: "auto" | "hrr" | "at_ant" | "max_hr" | "manual";  // "hrr" is already a valid value
lactateThresholdHr?: number;
aerobicThresholdHr?: number;
anaerobicThresholdHr?: number;
vo2max?: number;
age?: number;
gender?: string;
```

**What's actually missing** (confirmed by reading the code, not just the schema):

1. **No logic anywhere computes or updates `maxHr`** from real workout history. Would need to derive it from the observed max of `heartRate` samples across workouts over time (the Health Connect integration already fetches per-workout maxHR — see the Health Connect spike section above), falling back to an age/gender-based formula only when there isn't enough real data yet.
2. **No logic buckets heart-rate samples into zones at all.** The Health Connect spike's `deriveWorkoutMetrics()` only computes single avgHR/maxHR/minHR numbers for a workout, not time-in-zone. Doing so would mean: compute the 6 HRR thresholds from `maxHr`/`normalRestingHr`, then classify each `heartRate` sample within the workout's time range into a zone and sum durations per zone — using the same source-filtered sample set already fetched for maxHR/avgHR (no new Health Connect query needed, just new math over data already being pulled).

### HRR Zones And Workout Load implementation (2026-07-19)

- `src/lib/hrZones.ts` implements Zone 0–5 with Heart Rate Reserve (Karvonen): Restorative below 40%, then 40–60%, 60–70%, 70–80%, 80–90%, and 90%+ HRR.
- Samsung workout sync persists the source-filtered workout HR timeline as compact `{ at, bpm }` points. Existing records require another Health Connect sync before their zone breakdown can appear.
- Workout Detail calculates zones from the Profile Max HR and the median valid Resting HR from the latest 14 Sleep records. It does not substitute an age formula or workout minimum HR when either physiology value is missing.
- Time between consecutive samples is assigned to the earlier sample and capped at 120 seconds. Longer gaps are excluded from measured coverage instead of being presented as continuous HR data.
- RunMate Load is an explicitly estimated 0–100 session value: each measured minute is weighted by its zone number (Zone 0 = 0 through Zone 5 = 5), then divided by 3 and capped at 100. It is hidden until measured HR coverage reaches 50%.
- This first release is presentation-only. Workout Load does not modify Recovery, Strain, Race Plan, or AI guidance until it has been checked against real Samsung workouts.
- Workout Detail was visually rebalanced after the first implementation: Session Overview appears before HR analysis, RunMate Load is the primary HR summary value, coverage is secondary, empty zones are muted, and the HRR methodology note is easier to scan.
- `UI_GUIDELINES.md` is now the app-wide reference for font roles, Title Case versus Sentence case, spacing, card density, toolbar alignment, metrics, missing data, accessibility, and responsive review. Read it before future visual changes and migrate pages deliberately rather than mechanically rewriting all CSS.

## Mobile Profile, Health Sync, And Planning Follow-Up (2026-07-19)

Implemented the next user-facing Profile and planning layer in `runmate-mobile`:

- Added `/profile-settings` under More with only the values currently used by Recovery and planning: Max HR, Body Weight, Training Days, Preferred Long Run Day, Preferred Training Time, and Default Wake Time.
- Body Weight now requests Health Connect `weight` access and imports the latest plausible Samsung Health measurement from the last year. A manually edited weight remains protected from automatic overwrite.
- Max HR is never overwritten automatically. Profile shows the highest plausible HR observed in saved Workout/Strength records and requires the user to press `Use Value` before saving it.
- Source badges distinguish `Samsung Health`, `Manual`, `Highest Observed`, and `Profile Default`. Profile also warns before discarding unsaved changes.
- New Race Goals use Training Days, Preferred Long Run Day, and Current Longest Run from Profile as defaults.
- Refresh Plan explicitly asks whether to `Keep Current Setup` or `Use Latest Profile`; active race settings are not silently changed.
- Default Wake Time is stored account-side in `sleep_window_plans` using a reserved default row and is loaded by both Recovery and Sleep Window. A dated row remains the one-night `Save For Tonight` override.
- Sleep Window reloads on every Ionic view entry, preventing stale Profile wake times when returning from Settings. It labels a dated value as `Tonight Override` and offers the current Profile wake time separately.
- Recovery and Activity keep their page data mounted and delay/cool down automatic Health Connect sync, reducing tab-switch latency without removing pull-to-refresh or explicit Sync Now behavior.

Verification for this batch:

- `npm run test.unit -- --run`: 90/90 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with zero errors.
- `npm run build`: passed (Vite reports only the existing large-chunk advisory).
- `git diff --check`: passed.

Still requires physical-device confirmation: Samsung Health Body Weight should be checked end-to-end with `Health Connect > Sync Now > Profile & Settings` once an Android device is connected over ADB.

## Local Notifications (2026-07-19)

- Added a user-facing `/notifications` page under More with independent switches for Bedtime, Missing Sleep, Planned Workout, and meaningful Recovery changes. Preferences are stored on the device and default to enabled.
- Bedtime uses the current Sleep Window calculation, including tonight's override or the Profile default wake time. Planned Workout uses the pending Race Plan session and the Profile preferred training time; Rest days are not notified.
- Missing Sleep is scheduled natively for 8:00 AM. When RunMate refreshes and confirms fresh Sleep, the pending alert is replaced with the next morning's check. If the app opens after 8:00 AM with Sleep still missing, it sends at most once for that Bangkok date.
- Recovery alerts compare the fresh score with that day's baseline and require a change of at least 15 points. They are evaluated after RunMate receives fresh data and send at most once per day.
- Added `Send Test Notification` so notification permission, lock-screen delivery, and tap routing can be verified immediately on a physical device.
- Notifications now includes a collapsed `Notification Diagnostics` panel. It reads Android's actual pending queue and reports Scheduled, Monitoring, Off, or Attention for each reminder, including the next delivery time and a plain-language reason when nothing is pending.
- Notification taps route to Notifications, Sleep Window, or Recovery as appropriate. Android notification permission and reboot rescheduling are supplied by `@capacitor/local-notifications`.
- Important platform boundary: this is not a hidden Samsung Health background import. Capacitor Background Runner cannot invoke the Health Connect plugin from its headless JavaScript runtime. Health Connect remains foreground-triggered; native notification scheduling provides the morning reminder while Recovery changes are evaluated after a real foreground sync. A true background Health Connect importer would require a dedicated native Android Worker that reproduces reconciliation and authenticated persistence.
- Android release identity is now automatic: `versionName` comes from `package.json`, while `versionCode` defaults to `1000 + git commit count`. Build automation may override either value with `RUNMATE_VERSION_NAME` and `RUNMATE_VERSION_CODE`. Build distributable APKs only after committing so each distributed commit receives its final monotonic build number.
- Bedtime Reminder is scheduled exactly 60 minutes before the calculated `In Bed By` target, including targets after midnight. Its notification opens Sleep Window so the user can review or adjust tonight's wake plan.

## Android Signed Release Pipeline (2026-07-19)

- Production signing is configured in `android/app/build.gradle`. Local builds read ignored `android/keystore.properties`; CI can instead provide `RUNMATE_KEYSTORE_FILE`, `RUNMATE_KEYSTORE_PASSWORD`, `RUNMATE_KEY_ALIAS`, and `RUNMATE_KEY_PASSWORD`.
- The production RSA-4096 key was generated locally at `android/app/runmate-release.jks`. Its matching credentials are in `android/keystore.properties`. Both files are ignored by Git and must be backed up together in a secure private location. Losing either prevents future Play Store updates under the same app identity.
- Run `npm run android:signing:setup` only on a new machine with no signing files. It prompts for a hidden password and refuses to overwrite an existing key. The automation-only `-GenerateSecurePassword` option creates a random local credential without printing it.
- `npm run android:release:apk` runs unit tests, lint, the web build, Capacitor sync, and produces the signed APK at `android/app/build/outputs/apk/release/app-release.apk`.
- `npm run android:release:aab` performs the same gates and produces the Play Store bundle at `android/app/build/outputs/bundle/release/app-release.aab`. `npm run android:release` builds both.
- `npm run android:distribute -- -ReleaseNotes "..."` distributes the existing signed release APK through Firebase App Distribution to `jirayuknot55@gmail.com` by default. It intentionally does not rebuild, so run it only after a successful release build from the intended commit.
- First verified signed artifacts: `1.0.0 (1020)`. `apksigner` confirmed the APK has one RSA-4096 RunMate signer using APK Signature Scheme v2; Gradle's `validateSigningRelease`, `signReleaseBundle`, `assembleRelease`, and `bundleRelease` all passed.

### GitHub Actions release automation

- `.github/workflows/android-release.yml` runs automatically for tags matching `v*`. It runs unit tests, lint, the Vite build, Capacitor sync, signed APK/AAB builds, APK signature verification, GitHub artifact upload, and Firebase App Distribution to `jirayuknot55@gmail.com`.
- A manual `workflow_dispatch` run always builds and stores signed artifacts. Turn on its `distribute` input only when that manual build should also be sent through Firebase.
- Tags define `versionName` by removing the leading `v` (for example, `v1.0.1` becomes `1.0.1`). `versionCode` remains `1000 + full Git commit count`, so checkout must retain full history.
- Configure these GitHub Actions repository secrets before the first run:
  - `ANDROID_KEYSTORE_BASE64`: base64 of the binary `android/app/runmate-release.jks` file.
  - `RUNMATE_KEYSTORE_PASSWORD`, `RUNMATE_KEY_ALIAS`, and `RUNMATE_KEY_PASSWORD`: values matching that keystore.
  - `GOOGLE_SERVICES_JSON_BASE64`: base64 of `android/app/google-services.json`.
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the production mobile Supabase configuration.
  - `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete JSON for a dedicated Firebase App Distribution service account. Do not base64 this value; paste the JSON itself as the secret value.
- On Windows PowerShell, create the two base64 values without printing signing passwords:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('android/app/runmate-release.jks')) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes('android/app/google-services.json')) | Set-Clipboard
```

- Add secrets at GitHub > `Settings` > `Secrets and variables` > `Actions`. Keep the local keystore backup even after CI is configured; GitHub Secrets are not a signing-key backup.
- Standard release command after updating and committing `package.json` version:

```powershell
git tag v1.0.1
git push origin v1.0.1
```

- Never move or reuse a published version tag. If a release fails after distribution, fix the cause, increment the version, and create a new tag.

## Recovery Calibration And Trends

- The Recovery dial on the main Recovery page now opens `/recovery-trends`; this is a detail route, not another bottom tab.
- The page provides `7 Days` and `30 Days` ranges with one compact SVG chart for historical Recovery, recorded Sleep Score, and Workout Strain. Strain keeps its domain scale of 0–21 while being normalized only for chart positioning.
- Historical Recovery is reconstructed per night from the available Sleep Score, HRV, Resting HR, and Respiratory Rate using the same physiological weights and a trailing personal baseline. It is labeled `Calibrating` until at least three older nights exist. Missing nights remain blank and are never converted to zero.
- `Why Your Score Changed` compares the two latest nights with a Recovery score and describes factual signal movements rather than calling AI or claiming causation. The page also shows per-day score rows and data coverage such as `5/7 Nights`.
- Pull to refresh performs the existing today-only Samsung Health sync before rebuilding the trend. The normal page load reads persisted history without launching a 30-day Health Connect sync.
- Browser-based visual QA was unavailable in the implementation session because no browser backend was connected. Unit, type, lint, and build verification still apply; verify the page at 390px and a narrower physical-device viewport before release.

## Training Adherence

- Race Goal now compares the current weekly plan with deduplicated Workout and Strength history using deterministic date, workout-type, distance, and duration matching.
- The compact Training Adherence card sits below Plan Progress. It shows completed or adjusted sessions against all active sessions in the week, a progress percentage, and separate Completed, Modified, and Missed counts.
- `View Week` reveals daily statuses only when requested. A compatible workout near the planned volume is Completed; a different workout or a meaningful distance/duration change is Modified; a past unmatched session is Missed; and a future unmatched session is Upcoming.
- Rest and Recovery are supportive days. They remain visible in the weekly detail but are excluded from both the adherence denominator and the Missed count.
- Matching is factual and local; it does not call AI, change the Race Plan, or alter Recovery and Strain calculations.
- Weekly Summary now extends the same deterministic matching across the latest four calendar weeks. Each available plan week shows its adherence percentage and Completed, Adjusted, and Missed totals; tapping a week reveals the planned active sessions and their status.
- Historical adherence uses the matching entry from `plan.weeks` based on `planStartDate`. Weeks before the active plan began remain `No Plan Available`; the app never applies the current schedule retroactively. Rest and Recovery are excluded from the denominator and hidden from the expanded active-session list.

## Bedtime Reminder Reliability Fix

- Android now declares `SCHEDULE_EXACT_ALARM`, which is required for an exact one-hour-before-bedtime reminder on supported Android versions.
- Notifications refresh whenever the native app returns to the foreground, so a retained login session no longer leaves the previous day's schedule stale.
- Notifications shows a user-facing `Allow Exact Reminders` warning and Android Settings action when exact alarms are disabled. Notification Diagnostics also reports both display permission and exact-alarm status.
- After installing this release, open `More > Notifications`, allow Exact Reminders if prompted, then use `Refresh Schedule` and confirm Bedtime Reminder has a pending delivery time.

## App-Wide Layout And Density Sweep (2026-07-19)

- Completed a final consistency pass across Recovery, Activity, Upload, More, Profile & Settings, Notifications, Health Connect, Race Goal, Weekly Summary, Recovery Trends, Sleep Detail, Sleep Window, Workout Detail, Meal Detail, Health Detail, and Sign In.
- Page shells now share centered toolbar titles, a 600px maximum content width, balanced mobile spacing, readable secondary text, visible keyboard focus, and at least 44px interactive targets where practical.
- Dense groups of bordered metric cards were consolidated into quieter panels or divided rows. Primary actions and current-day information remain visible while Data Coverage, guidance, diagnostics, history, and other secondary material use disclosures.
- Sign In now presents Google as the primary path and keeps email/password access available behind a secondary disclosure. Detail pages use the same section-label, heading, body-copy, metric, and read-only-list hierarchy.
- Weekly Summary now includes deterministic current and historical Training Adherence without retroactively applying the current plan to earlier weeks.
- This pass did not change Recovery, Sleep, or Strain scoring; Health Connect reconciliation; notification scheduling; or AI prompts and analysis logic.

Final verification for this batch:

- `npm run test.unit -- --run`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

All commands above must pass before the signed Android artifact is distributed. Physical-device review remains recommended for the narrowest supported Android viewport and system font scaling.

## Weekly Workout Load Trend (2026-07-19)

- Weekly Summary now includes a separate `Workout Load` card below `Movement At A Glance`. The volume card remains focused on sessions, running distance, and active time; the new card is explicitly about measured cardiovascular intensity.
- The card totals estimated RunMate Load for the latest seven Bangkok dates, compares it with the previous seven dates, and labels the direction as Starting Point, Easing, Stable, Building, or Rising Quickly.
- A compact seven-day bar chart distinguishes measured Load, sessions with insufficient HR coverage, and days with no Workout. Coverage copy states how many saved sessions contributed to the total.
- Each session uses the same HRR calculation as Workout Detail: Profile Max HR, the median valid Resting HR from the latest 14 Sleep records, source HR samples, a 120-second gap cap, and a minimum 50% measured coverage before Load is accepted.
- The result remains labeled `Estimated`. It does not change Recovery, Strain, Race Plan, Training Adherence, or AI guidance.
- `src/lib/workoutLoadTrend.ts` owns the pure 7-day/previous-7-day aggregation and is covered by focused unit tests for measured, sparse, and missing-physiology cases.

## Focused Refactor Roadmap (2026-07-20)

Health Connect sync triggers now share `healthSyncService.ts`: foreground pages sync today with the existing cooldown, Sync Now checks 30 days plus Weight, and Repair Last 30 Days reconciles Workout history only.

Loading, error, retry, and empty presentations now share `PageState.tsx` across the primary data-heavy pages while retaining each page's existing data flow.

The same state treatment now covers Sleep Details, Sleep Window, Race Goal, and Meal/Health record details. Sleep Window also surfaces load failures with an explicit retry instead of leaving an unhandled blank state.

`AppErrorBoundary.tsx` now prevents an unexpected render failure from leaving the app blank. It offers Reload and Return To Recovery actions and stores only a compact, session-scoped error summary (time, route, error name, and message) for safe diagnostics.

Activity row navigation, record presentation, source labels, and delete affordance now live in `ActivityHistoryRow.tsx`; `ActivityPage.tsx` retains date selection, nutrition totals, loading, sync, and deletion orchestration.

The authentication E2E contract now follows the current Login hierarchy: Google remains primary, email/password stays behind its disclosure, and the removed legacy account copy is no longer asserted.

The next product feature is Adaptive Training Plan, but the agreed sequence is a short, bounded refactor first. This is not a rewrite and must not change Recovery, Sleep, Strain, Health Connect reconciliation, notification timing, Race Plan output, or AI prompts.

Refactor priorities:

1. Separate Coach Context calculation from Supabase loading, cache ownership, and invalidation.
2. Route Coach Context reads and refreshes through one shared service so pages do not create competing cache policies.
3. Consolidate Health Connect sync orchestration and make trigger scope explicit: today on foreground/page refresh, 30 days only from Health Connect actions.
4. Standardize trustworthy-data state as Measured, Estimated, or Missing at the presentation boundary.
5. Add an app-level Error Boundary and user-safe runtime diagnostics before expanding the audience.
6. Add integration coverage for app startup, rapid Recovery/Activity tab switching, changed-data refresh, empty data, and failed sync.

Health sync integration coverage now locks the trigger contract: foreground calls use `today`, explicit Sync Now uses 30 days plus Weight, and Repair uses only the 30-day Workout path. The remaining interaction-focused coverage can build on this service boundary without invoking the native plugin in page tests.

The first refactor slice moves Coach Context network/cache orchestration into `src/lib/coachContextService.ts`; `buildCoachContext.ts` remains responsible for deterministic context construction and scoring inputs. Existing callers use the service without changing calculated output. Continue refactoring in small verified slices rather than reorganizing the entire repository at once.

After the stability release, proceed in this order:

```text
Adaptive Training Plan
-> Workout Load Calibration
-> Nutrition Goals And Trends
-> Play Store Readiness
```

Adaptive plan changes must remain visible suggestions (`Keep`, `Reduce`, `Swap`, or `Rest`) with a clear reason. They must never silently rewrite the active Race Plan.

## Adaptive Training Plan (2026-07-20)

- Recovery's existing `Today's Focus` card now owns the adaptive recommendation so the page does not gain another competing card.
- `src/lib/adaptiveTrainingPlan.ts` produces one deterministic action: `Keep`, `Reduce`, `Swap`, or `Rest`. It does not call AI and does not change Recovery, Sleep, Strain, or Race Plan calculations.
- Safety order is explicit: active Pain or Sick status caps the day at Rest; stale or insufficient Recovery never triggers an adjustment; low Recovery rests demanding sessions or swaps easy sessions for recovery movement; moderate Recovery reduces demanding sessions; already-high Strain can also reduce the remaining load.
- `Reduce` keeps the workout type but targets about 70% of its distance/duration and easy Zone 1-2 effort. `Swap` becomes a short Recovery Walk. `Rest` removes workout metrics for today.
- Adaptive guidance is shown immediately; there is no Review or Apply button because the feature does not modify the Race Plan. The adjusted metrics are a recommendation for today, and the original planned workout remains visible for context.
- No adaptive decision state is persisted. The active Race Plan object remains untouched, and factual Training Adherence continues to use the workout the user actually logs.
- Once a workout is logged, the adaptive prompt disappears and the existing factual completed/adjusted status takes over.
- Coverage: pure decision tests cover all four actions, safety caps, missing data, and completed workouts; a component test verifies immediate adjusted metrics, no confirmation controls, and an unchanged Race Plan.

## Neutral Upload Entry State (2026-07-20)

- Upload no longer chooses Sleep, Workout, or Meal from the time of day or today's saved records.
- The page opens with all three choices unselected and asks the user which record type to upload.
- Selecting a type reveals the existing flow; Meal Time can still use its Bangkok-time default after the user explicitly chooses Meal.
- Meal photo selection, AI review, editable food lines, nutrition review, and save behavior now live in `MealUploadFlow.tsx`; `UploadPage.tsx` only owns the neutral Sleep / Workout / Meal selection shell.

## AI Coach (2026-07-20)

- `More > AI Coach` is a separate authenticated detail route. It is not a bottom tab and does not add more content to Recovery.
- The page offers five bounded questions: what to do today, why Recovery changed, whether to adjust today's Workout, how to fuel today, and whether training is on track for the active Race Goal.
- AI calls are user-triggered only. Opening the page loads the existing cached Coach Context but does not call Gemini.
- `src/lib/aiCoach.ts` builds a compact coaching payload containing only today's Recovery summary, planned and completed Workout summaries, seven-day aggregate training, today's logged nutrition, active Race metadata, and concise Pain/Sick guardrails.
- Raw Health Connect samples, full history records, account identifiers, email, image URLs, and profile notes are never included in the AI payload.
- The `ai-coach` Supabase Edge Function authenticates the caller, validates the selected topic, limits payload and answer size, and uses `gemini-3.1-flash-lite` unless the deployed `GEMINI_MODEL` overrides it.
- UI controls remain English while the generated recommendation is Thai. The response contract contains one headline, summary, up to four actions and reasons, explicit missing data, an optional caution, and short follow-up suggestions.
- Fuel answers include a dedicated `Next Meal` section with Bangkok-time awareness, the meals already logged today, and two or three practical Thai meal options. Sleep durations are sent in display-ready hour/minute form so AI copy does not expose raw totals such as `259 minutes`.
- AI Coach is advisory only. It must never claim to change the Race Plan, Recovery score, saved records, notifications, or scoring logic. Pain and illness always take priority over performance advice.
- Verification for this slice: all 139 unit tests pass, lint passes with zero errors, production build passes, and the `ai-coach` Edge Function was deployed successfully.

## Nutrition Trends (2026-07-20)

- Activity's `Daily Meal Total` card now links to the authenticated `/nutrition-trends` detail route. Nutrition Trends is not a bottom tab and does not add content to Recovery.
- The page provides 7-day and 30-day ranges built from saved Meal, Workout, and Strength history. Missing dates remain blank and are never interpreted as zero intake.
- `Your Logged Nutrition` shows logged-day coverage, total Meals, and the number of logged days that contain Protein data. Daily averages for Calories, Protein, Carbs, and Fat use only days where each value is available.
- Calories and Protein use separate compact bar charts with independent scales so the two units are not visually compared as though they share a common axis.
- `Training And Rest Days` compares average logged Calories and Protein by factual Workout presence. It is explicitly presented as context, not a nutrition target or a causal claim.
- The deterministic pattern card reports low logging coverage or a meaningful logged Protein difference between training and rest days. It does not invent calorie, macro, body-composition, or medical targets.
- The page links to AI Coach for practical next-meal guidance. AI remains user-triggered and separate from the factual trend calculation.
- `src/lib/nutritionTrends.ts` owns date-window aggregation and missing-data behavior, with focused tests covering exact ranges, averages, training/rest classification, and unknown macros.

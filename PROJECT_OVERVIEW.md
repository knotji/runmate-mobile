# WholeMate Mobile — Project Overview

_A reference snapshot of the app as of 2026-08-20: what it is, how the UI/UX is organized, and how the source code is structured. For a chronological changelog see `HANDOFF.md`; for the original IA migration history see `IA_REFACTOR_ROADMAP.md`._

## 1. What this is

**WholeMate** (package id `com.runmate.mobile`, still `RunMate` internally in a lot of source/string identifiers — a deliberate rebrand that kept the Android application id unchanged so updates install over existing testers) is a personal health, recovery, and training companion built with **Ionic React + Capacitor**. It answers one question: *"How is my body today, what is shaping it, and what should I do next?"* Running is one movement module inside that, not the whole product.

It shares its Supabase backend with a sibling Next.js web app (`runmate-ai`), and ports its core data-layer logic from that project (kept browser/Capacitor-safe — no `next/`, no `"use server"`, no service-role client).

### Tech stack

- **UI**: Ionic React `@ionic/react` 8.x, React 19, React Router 5 (`react-router-dom`)
- **Native shell**: Capacitor 8 (Android + iOS), plugins for Health Connect (`@capgo/capacitor-health`), local notifications, haptics, filesystem, share, crashlytics, status bar, keyboard
- **State**: Zustand stores (`src/lib/context/coachContextStore.ts`, `src/lib/profile/userProfileStore.ts`, `src/lib/race/racePlanStore.ts`, `src/lib/health/healthSyncStore.ts`)
- **Backend**: Supabase (Postgres + Auth + Edge Functions), timezone-locked to `Asia/Bangkok` for all "today" logic
- **AI**: Google Gemini, called only from Supabase Edge Functions (never directly from the client) — `ai-coach`, `generate-race-plan`, `analyze-meal`, `analyze-sleep`, `analyze-workout`
- **Build/test**: Vite, Vitest (also runs the Deno-flavored edge-function test files under `supabase/functions/**/*.test.ts`), ESLint, `tsc --noEmit`
- **Release**: `scripts/build-android-release.ps1` (tests → lint → build → `cap sync` → Gradle `assembleRelease`/`bundleRelease`, with a Health-Connect-permission gate that fails the build if any unexpected `WRITE_*` permission appears) and `scripts/distribute-android-release.ps1` (Firebase App Distribution)

---

## 2. UI/UX architecture

### 2.1 Navigation shell

Four primary tabs, defined in `src/components/MainTabs.tsx` inside a single `IonTabs`/`IonRouterOutlet`, each lazy-loaded and idle-prefetched:

| Tab | Route | Page component | Icon |
|---|---|---|---|
| **Today** | `/tabs/today` | `RecoveryPage.tsx` | home |
| **Health** | `/tabs/health` | `HealthPage.tsx` | heart |
| **Move** | `/tabs/move` | `ActivityPage.tsx` | fitness |
| **You** | `/tabs/you` | `MorePage.tsx` | person-circle |

**Coach** (`/tabs/coach` → `AiCoachPage.tsx`) and **Log** (`/tabs/log`, `/tabs/upload` → `UploadPage.tsx`) sit in the same router outlet but are *not* tab-bar buttons — they're reached via in-page entry points (a "+" button on Today/Health/Move opens Log; a sparkle/"Ask Coach" affordance on Today/Health/Move/You opens Coach). Legacy routes (`/tabs/recovery`, `/tabs/activity`, `/tabs/settings`, `/tabs/more`, `/tabs/history`) redirect to their current equivalents for backward compatibility with old deep links/widgets.

All `/tabs/*` routes (and most detail routes) are session-gated — signed out, they redirect to `/login`. A separate, frozen `/labs/*` route block (see §2.4) is intentionally session-independent.

### 2.2 The four tabs, what each one does

**Today** (`RecoveryPage.tsx`) — the daily hero screen, promoted 2026-08-22 to the hierarchy prototyped in the frozen `src/labs/wholemate-next` reference: Body Status hero → one 4-ring row (Recovery/Sleep/Strain/Energy, all equal — Sleep shows actual duration, not its score) → WHY/Likely Limiter card (`recoveryWhy.ts`) → optional Yesterday→Today continuity card (`todayContinuity.ts`) → One Adjustment action card, page ends there. Ask Coach is a floating FAB, not an inline button. The old single "Today's Brief" card and the Sleep Plan/Tomorrow card were both removed — Sleep Plan access now lives on Health's Sleep destination (`SleepDetailPage.tsx` → `/sleep-window`) instead of being duplicated here. Wired into `useCoachContextStore`, a dedicated startup cache, background Health Connect sync, and (indirectly) the home-screen widget — still the highest-risk page in the app because of that wiring.

**Health** (`HealthPage.tsx`) — "This Week's Signals" (a 7-day Recovery trend bar chart + an adaptive 0–4-tile stat grid for HRV/RHR/Sleep/Nutrition that only shows tiles with a real value, plus a Data Sources & Freshness card that never fabricates a value for missing data) above a single flattened "EXPLORE" list of 8 destinations (Health Calendar, Sleep, Strain, Recovery Trends, Nutrition, Body Weight, Fitness Age, Pain & Injury) and a Health Connect entry.

**Move** (`ActivityPage.tsx`) — a date navigator (defaults to today, persisted across navigation via `primaryTabState.ts`), a Plan/Race/Summary quick-nav row, a Planned Training card, a Daily Fuel Coach card (today's fuel status against protein/carb targets, plus a "Logged Meals" list for the selected day — the only place in the app to browse back to a previously logged meal), and a collapsible-by-category list of the day's recorded workouts/strength sessions.

**You** (`MorePage.tsx`) — a personal-context page, not a settings menu: Your Focus (active race goal or a prompt to set one) → Your Context (today's plan, pain status, body weight) → Today's Check-In (stress/environment, only if logged) → a flattened **Personal Controls** list (Coach History, Profile & Settings, Notifications, Health Connect, Privacy/Export/Account, About WholeMate) → Account/Sign Out.

**Coach** (`AiCoachPage.tsx`) — a real chat UI (not a form): message bubbles, Today/Yesterday date dividers, a fixed `IonFooter` input bar, a collapsible "Based On Your Data" context drawer, and Gemini-generated replies rendered with light Markdown (bold key numbers, bullet lists) instead of a flat text block.

### 2.3 Visual language

Each promoted page owns a small, self-contained set of CSS custom properties (`--move-*`, `--health-*`, `--you-*`) scoped to a page-level selector — deliberately **not** declared on `:root`, and not imported from the frozen labs token file, so production has no dependency on `src/labs/**`. Consistent premium-card language across pages: rounded cards, soft shadows, a navy/teal palette, circular conic-gradient dials for every "score" (Recovery/Sleep/Strain/Energy all use the same ring technique).

### 2.4 `src/labs/wholemate-next/` — frozen prototype, reference only

The original design-exploration prototype for this visual language (Today/Health/Move/You built with mock *and* real-data modes, reachable only at `/labs/*-next`, no nav link). All four `/tabs/*` pages have since been promoted to match it, so this directory is **frozen as of 2026-08-20** — kept only as a proven visual reference for comparing against a future regression, not an active development target. See `src/labs/wholemate-next/README.md` for the removal trigger (delete once real-device QA is clean across all four tabs and one release has shipped).

### 2.5 Detail/secondary pages

Reached from the four tabs, each session-gated: Sleep Detail, Sleep Window, Recovery Trends, Nutrition Trends, Strain Detail, Energy Reserve, Fitness Age, Body Weight Trend, Pain Trends, Health Calendar, Health Connect (`HealthTestPage.tsx`), Race Goal, Weekly Plan Calendar, Weekly Summary, Weekly Recap, Profile & Settings, Notifications, Privacy/Export/Account, About, Workout/Meal/Health record detail pages, Login.

---

## 3. Logic / source architecture

### 3.1 Layout

```
src/
  pages/         one file per route (see §2), usually paired with a .css and sometimes a .test.tsx
  components/    shared UI (cards, modals, upload flows) — health/ and race/ subfolders for domain-specific pieces
  lib/           almost all business logic — see §3.2
  types/         shared TypeScript types (profile, race, logs, pain, sick, strength)
  labs/          frozen prototype, §2.4
  theme/         Ionic theme variables

supabase/
  functions/     Edge Functions (Deno) — the only place that calls Gemini
```

`src/lib/` is intentionally flat for most files (grep-friendly), with a few subfolders for state stores and larger domains: `context/` (the shared context-building pipeline), `goals/`, `health/`, `profile/`, `race/`, `readiness/`, `supabase/`, `hooks/`.

### 3.2 The context-building pipeline (the app's real backbone)

Almost every page/engine consumes one shared object, **`CoachContext`** (`src/lib/buildCoachContext.ts`, assembled by `src/lib/context/buildCoachContextCore.ts` from `contextTypes.ts`'s shape): today's date, the full `RunMateRecoverySystem`, today's/this-week's workouts, nutrition today, pain/sickness state, active race goal, and the **raw Supabase profile row** (`context.profile: Record<string, unknown> | null` — untyped on purpose, since it's the actual database row, not the app's typed `UserProfile`).

- `coachContextService.ts` / `coachContextStore.ts` — fetch and cache the context, with `buildCoachContextFromSupabase()` as the main entry point most pages call.
- Every "*StartupCache.ts" file (there are ~20 of them, one per page/section) is the same pattern: a synchronous, date-keyed `localStorage` read on mount for an instant paint, then a background refresh via `useIonViewWillEnter` that only commits if it's still the latest in-flight request (a `useRef` generation-counter guard, added deliberately so rapid tab-hopping can't let a stale response overwrite a newer one). Deliberately **not** a shared cache across pages — each page's cache is independent, so a shape mismatch in one can't corrupt another.

### 3.3 The "Body Intelligence" engine — Recovery, readiness, and daily guidance

A composable, read-only layer over `CoachContext`, no new database tables:

- **`personalBaseline.ts`** — single source of truth for HRV/RHR/Respiratory/Sleep-duration personal baselines (median, `insufficient|calibrating|ready` state).
- **`recoverySystem.ts`** — builds the WHOOP-style `RunMateRecoverySystem` (overall score, Sleep Performance, Strain, per-signal `factors[]` with `direction: helping|hurting|neutral|unavailable`).
- **`recoveryExplainability.ts`** — groups factors into helping/hurting; returns explicit `unavailable` rather than presenting stale data as fresh.
- **`dailyRecommendation.ts`** — deterministic `push|normal|reduce|recover`, advisory only (never mutates the Race Plan). Built from Recovery + Sleep + Strain + `runDays7d` (a day-count proxy for weekly load — a known, accepted limitation, not upgraded to an intensity-aware signal without a specific ask) + today's planned workout.
- **`todayBrief.ts`** — the single source of truth for Today's "Body Status" line; keys off `dailyRecommendation`'s already-computed action rather than re-deriving one from the Recovery score alone (a real bug, fixed once already — see `HANDOFF.md`).
- **`adaptiveTrainingPlan.ts`** — same-day plan adjustments (keep/reduce/swap) layered on top of the committed weekly plan.

### 3.4 Nutrition — `dailyFuelCoach.ts`

Deterministic (no AI) protein/carb targets for the selected day, scaled by body weight and day type (rest/easy/strength/hard/long), with an explicit user-facing status ("needs weight" vs "ready") and a recommendation engine. A body-recomposition goal (see §3.6) can only ever raise the protein factor — the carb-factor function has no parameter that could receive the goal at all, so training fuel/carb availability can structurally never be reduced by it.

### 3.5 Race planning

- **`racePlanGeneration.ts`** (client) builds a compact `RacePlanGenerationContext` from `CoachContext` and calls the `generate-race-plan` Edge Function.
- **`supabase/functions/generate-race-plan/index.ts`** — Gemini-backed, with a fully deterministic **fallback plan builder** (`buildFallbackPlan`) used whenever the AI call fails or no API key is configured, so the feature never hard-fails. Race Week logic (Race Day pinning, taper, shakeout run, primer session) is enforced identically whether the AI or the fallback produced the plan (`enforceRaceWeek`), and validated against several once-real bugs (a "202" weekday-corruption bug, Race Day silently overridden by "already logged today" logic, etc. — see `HANDOFF.md`).
- **`plan-policy.ts`** (co-located with the Edge Function, mirrors `ai-coach/prompt-policy.ts`) — the one piece of plan-generation *decision logic* pulled out into a small, pure, directly-unit-tested module: which off-days become Strength Training, and how a body-recomposition goal preserves up to 2 such slots/week instead of 1, without ever displacing a running day.
- **`racePlanRefresh.ts`** / **`racePlanVersions.ts`** — merging a freshly generated plan into the runner's already-committed week without silently rewriting locked/completed days.

### 3.6 Goals — `src/lib/goals/`

`UserGoalProfile` (`goalTypes.ts`): a `primaryGoal` plus `secondaryGoals`/`guardrailGoals` from a fixed `GoalType` union (`race_performance`, `running_consistency`, `general_health`, `fat_loss`, `six_pack`, `muscle_gain`, `injury_prevention`, `injury_recovery`, `sleep_better`, `stress_balance`), persisted to Supabase's `goal_profile` column and editable from **Profile & Settings → Your Goals**.

`goalContext.ts` is the shared extraction point (`extractGoalProfile()` validates the raw Supabase row against `GoalType` rather than trusting it blindly; `hasBodyRecompositionGoal()` checks for `six_pack`/`fat_loss`/`muscle_gain`). The cross-system rule, applied differently per consumer: **primary goal guides prioritization; secondary goals influence trade-offs and supporting recommendations, but never override safety, Recovery, or the primary training objective.** Consumed by race-plan generation (§3.5), Daily Fuel Coach (§3.4), the Sleep/Rest card (`RecoveryDialsView.tsx`'s `RecoveryPlan`, an additive copy-only note that never changes the recovery-driven decision), and AI Coach (§3.7).

### 3.7 AI Coach — `src/lib/aiCoach.ts` + `supabase/functions/ai-coach/`

`buildAiCoachContext()` compacts `CoachContext` (recovery, today's plan, recent training, nutrition, race, health, goals) into a small payload; `askAiCoach()`/`askAiCoachChat()` call the Edge Function and fall back to a canned local answer if the network call fails, so Coach is never fully broken offline. The Edge Function's prompt (`prompt-policy.ts` holds the origin-aware instructions) is deliberately constrained: natural Thai, one clear answer to the actual question, a race is optional context never forced into unrelated small talk, only facts present in the compact context (never invented wearable/nutrition values), and — as of the most recent pass — explicitly allowed to give a **thorough, detailed** answer using light Markdown (`**bold**`, `- ` bullet lines) instead of a hard 140-word cap, since the client now renders that formatting for real instead of flattening it to plain text.

### 3.8 Health sync

`healthSyncService.ts` + `healthSyncStore.ts` orchestrate pulling from Health Connect/Samsung Health (`samsungWorkoutSync.ts`, `samsungSleepSync.ts`, `samsungBodySync.ts`, `samsungProfileSync.ts`) and reconciling with manually logged records (`workoutDedupe.ts`, `sleepDedupe.ts`, `mealMerge.ts`, `reconciliationPolicy.ts`). Deliberately **read-only** except one documented opt-in exception (`WRITE_NUTRITION`, gated by a user-facing toggle) — enforced not just by convention but by the release script's Health-Connect-permission gate, which fails the build if any other `WRITE_*` permission appears in the merged manifest.

### 3.9 Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `ai-coach` | Gemini-backed chat/topic answers for the Coach tab |
| `generate-race-plan` | Gemini-backed weekly training plan, with a full deterministic fallback |
| `analyze-meal` / `analyze-sleep` / `analyze-workout` | Vision/data extraction for manually logged records |
| `delete-account` | Service-role account deletion (the one place that needs elevated privileges the client never holds) |

All Gemini calls happen server-side only — the client never holds or sends an AI provider key.

---

## 4. Known, accepted limitations (not bugs)

- `runDays7d` (weekly training-load proxy) is a plain day-count, not intensity/duration-aware — explicitly deferred, not to be "fixed" without a specific ask.
- Every real-data path in this codebase is effectively unverifiable end-to-end from this dev machine (no real Supabase session) — verification for authenticated flows relies on unit tests, deterministic-fallback testing, Playwright renders against seeded `localStorage`/mock auth tokens, and the user's own on-device confirmation after each release.
- `src/labs/wholemate-next/` is intentionally frozen, not deleted yet (§2.4).
- `bodyGoal`/`lifestyleGoal`/`guardrailGoals` sub-objects on `UserGoalProfile` have no settings-page editor yet — only `primaryGoal`/`secondaryGoals` are user-editable today.

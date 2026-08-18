# Product Screen Ownership Map

Status: Phase 4 ownership consolidation implemented; AI function deployed; mobile release and physical-device validation pending

This map assigns every current RunMate screen to one canonical product destination. It changes information architecture, not the meaning or storage of existing records.

## Ownership rules

- **Today** owns the shortest useful daily story: body state, shaping evidence, one action, and freshness.
- **Health** owns measured evidence, trends, baselines, nutrition, body context, data quality, and source detail.
- **Move** owns recorded and planned movement, training, running, strength, race goals, and summaries of training execution.
- **You** owns goals, optional context, reflection, account, privacy, connections, preferences, diagnostics, and settings.
- **Contextual Coach** interprets the current surface; it is not a permanent primary destination.
- **Log** is a secondary intake fallback, not a product pillar.

## Primary destinations

| Current route | Current screen | Canonical owner | Migration |
| --- | --- | --- | --- |
| `/tabs/today` | `RecoveryPage` | Today | Keep route and make its daily story contract explicit |
| `/tabs/health` | `HealthPage` | Health | Keep route |
| `/tabs/move` | `ActivityPage` | Move | Keep route |
| `/tabs/coach` | `AiCoachPage` | Contextual Coach | Legacy route preserved; no longer a primary tab |
| `/tabs/you` | `MorePage` | You | Canonical primary route |
| `/tabs/settings` | `MorePage` | You | Compatibility redirect to `/tabs/you` |

## Today-owned flows

| Route or surface | Ownership decision |
| --- | --- |
| `/tabs/today` | Body Picture, main shaping evidence, one next action, freshness, daily sleep-plan summary, and a compact contextual Coach action |
| `/sleep-window` | Contextual planning flow opened from Today; detailed sleep evidence remains in Health |
| `/energy` | Today evidence detail; Health may link to its trend/evidence context |
| `/strain` | Today evidence detail while the score is current-day; source records remain under Health/Move |

Today must not absorb long histories, generic chat, account setup, complete activity lists, or detailed trend charts.

## Health-owned flows

| Current route | Screen | Migration |
| --- | --- | --- |
| `/sleep` | Sleep detail | Keep; return to the originating Today or Health surface |
| `/recovery-trends` | Recovery trends | Keep under Health |
| `/nutrition-trends` | Nutrition trends | Keep under Health |
| `/activity/meal/:id` | Meal detail | Keep record compatibility; canonical discovery is Health nutrition |
| `/activity/health/:id` | Health record detail | Keep record compatibility; canonical discovery is Health |
| `/pain-trends` | Pain and injury trends | Keep under Health |
| `/body-weight-trend` | Body weight trend | Keep under Health |
| `/fitness-age` | Fitness age | Keep under Health and preserve model provenance |
| `/health-calendar` | Health Calendar and habit insights | Keep under Health |
| `/health-connect` | Provider status and diagnostic detail | Health owns source evidence; You owns permission/control entry points |
| `/health-test` | Legacy Health Connect alias | Redirect to `/health-connect` |

Health may explain evidence but must not become the owner of training prescriptions.

## Move-owned flows

| Current route | Screen | Migration |
| --- | --- | --- |
| `/tabs/move` | Daily movement, planned training, and training-day fuel guidance | Keep route; meal, sleep, and body records remain discoverable through Health rather than the Move record list |
| `/activity/workout/:id` | Workout detail | Keep under Move |
| `/race-goal` | Race goal | Keep as a running-specific Move tool |
| `/weekly-plan` | Weekly training plan | Keep under Move |
| `/weekly-summary` | Calendar-aligned training summary | Keep under Move; link to Health evidence when needed |
| `/weekly-recap` | Training recap/share flow | Keep under Move |
| `/history/workout/:id` | Obsolete history alias | Continue redirect to Move until usage is proven absent |

Move must remain activity-inclusive. Running can be a differentiated capability without making non-running movement secondary or unsupported.

## You-owned flows

| Current route | Screen | Migration |
| --- | --- | --- |
| `/tabs/more` and `/tabs/settings` | Settings and Data | Compatibility redirects to canonical `/tabs/you` |
| `/profile-settings` | Profile, physiology, preferences and goals | Keep under You |
| `/notifications` | Reminder preferences and diagnostics | Keep under You |
| `/privacy-data` | Privacy, collection, export and deletion | Keep under You |
| `/about` | Version, release health and diagnostics | Keep under You |
| `/login` | Authentication | Global account flow outside the tab hierarchy |

Provider controls may be entered from You while provider evidence and freshness remain visible in Health.

## Contextual Coach

| Current route or entry | Migration |
| --- | --- |
| `/tabs/coach` | Preserve as a compatibility route and redirect/open the full Coach experience without keeping it as a primary tab |
| `/ai-coach` | Preserve as the focused full-screen Coach route |
| Today Coach action | Seed context with current Body Picture, shaping evidence, freshness, and the user's actual question |
| Health Coach action | Seed only the selected trend/evidence and its provenance; do not default to race coaching |
| Move Coach action | Seed the selected workout/plan/race context when relevant |

One device-local Coach history remains the source for all entry points. Migration must not create per-tab histories or discard the unfinished draft.

## Secondary Log

| Current route | Migration |
| --- | --- |
| `/tabs/log` | Keep as canonical secondary intake flow |
| `/tabs/upload` | Keep as a legacy redirect/alias |

Sleep, Workout, and Meal intake retain review and confirmation before saving. Photo analysis remains optional; manual text entry remains available.

## Compatibility routes to preserve

- `/tabs/recovery` -> `/tabs/today`
- `/recovery` -> `/tabs/today`
- `/tabs/activity` -> `/tabs/move`
- `/tabs/history` -> `/tabs/move`
- `/tabs/upload` -> Log
- `/tabs/more` and `/tabs/settings` -> You after migration
- `/tabs/coach` -> contextual/full-screen Coach after migration

Notifications, widgets, saved links, and cold deep links must be tested against these routes before any alias is removed.

## Phase 3-4 duplication decisions

- Today Body Picture, Energy Reserve, Today's Brief, and Sleep Plan should tell one daily story rather than repeat status copy.
- Health overview cards should link to canonical trends instead of reproducing full trend summaries.
- Move Daily Fuel Coach links to Health nutrition evidence while keeping training-day action in Move; the duplicate Daily Meal Total card has been removed.
- Settings/Data Sources and Health source status should share one provider state rather than start separate refreshes.
- Contextual Coach entry points must reuse one context builder and one history store.

These decisions preserve record storage and detail routes. Only canonical discovery and summary placement change; device regression coverage remains required before release acceptance.

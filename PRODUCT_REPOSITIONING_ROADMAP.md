# RunMate Product Repositioning Roadmap

Status: Phase 5 WholeMate identity and artwork implementation complete; function deployment, update-install validation, and release pending
Current product: RunMate
Approved future display name: WholeMate
Target positioning: Personal health and recovery companion

## Product promise

The repositioned product should answer three questions before exposing individual metrics:

1. How is my body today?
2. What is shaping that state?
3. What is one useful thing I can do next?

Running remains a differentiated strength, but it belongs inside the broader movement experience rather than defining the whole product.

## Locked decisions

### Android identity and upgrade path

The installed application remains the same Android application.

- Keep the Capacitor and Android application ID `com.runmate.mobile` unchanged.
- Keep the existing Android package/namespace unless a separate code-only refactor is explicitly approved.
- Keep the existing Firebase Android registration, signing identity, Health Connect declaration, OAuth/deep-link compatibility, notification channels, widgets, and tester upgrade path.
- Preserve local storage, cached health context, chat history, preferences, and all account-backed data across the rebrand.
- Do not publish the renamed product as a second Android application.

The rebrand changes only the user-facing product identity: display name, logo, launcher icon artwork, splash/brand artwork, and approved user-facing brand copy. Existing internal resource names may continue to contain `runmate` when renaming them would create risk without user value.

### Product and data safety

- Do not change Recovery, Sleep, Strain, Energy Reserve, nutrition, or training formulas as part of the repositioning.
- Do not migrate or rewrite stored health, meal, workout, race, plan, Coach, or profile records merely to match the new information architecture.
- Health Connect remains the source of measured Android health data and keeps its existing permission behavior.
- Missing data remains visibly unavailable; the rebrand must not create substitute health values.
- AI may interpret approved evidence but must not become a measurement source or a prerequisite for understanding Today.

## Target information architecture

| Destination | Primary question | Ownership |
| --- | --- | --- |
| Today | How am I today, why, and what next? | Body picture, key shaping evidence, one next action, freshness |
| Health | What is changing over time? | Sleep, recovery, heart context, nutrition, weight, fitness age, pain, calendar, trends and sources |
| Move | What did I do and what is planned? | Workouts, strength, walking, running, weekly plan, race goal and movement records |
| You | What matters to me and what can I control? | Goals, optional context, reflections, profile, privacy, connections, diagnostics and settings |

Coach is not deleted. It becomes contextual assistance opened from Today, Health, Move, and relevant detail screens. Existing Coach history remains available during and after route migration.

Manual Log remains a secondary action for records that cannot be imported automatically. It is not a primary product destination.

## Delivery strategy

Continue development in the existing Ionic/Capacitor application. Do not combine this product migration with a Compose rewrite. `runmate-compose` is the product-contract and architecture reference; production behavior is migrated to `runmate-mobile` in bounded, testable slices.

Each phase must be independently releasable and must preserve legacy routes until the replacement has passed tester validation.

## Phase 0 - Baseline and brand decision

Estimated effort: 1-3 working days, excluding name availability review

- [ ] Confirm the future display name after basic store, domain, social, and trademark screening.
- [x] Approve the primary logo, launcher-icon treatment, light/dark usage, and small-icon legibility.
- [x] Record the current production routes, storage keys, deep links, OAuth callback, Firebase app, notification behavior, widget behavior, and signed-release identity in `REBRAND_IDENTITY_CHECKLIST.md`.
- [ ] Capture baseline screenshots and performance diagnostics for Today, Health, Move, Coach, Log, and Settings.
- [ ] Establish a release branch or tagged baseline before user-facing identity changes.

Exit criteria:

- The name and visual identity are approved for tester use.
- `com.runmate.mobile` is present in a locked identity checklist as unchanged.
- Existing local and cloud data can be compared before and after the migration.

## Phase 1 - Product contract adoption

Estimated effort: 2-4 working days

- [ ] Adopt the product promise and evidence classifications in user-facing copy and tests.
- [ ] Define the boundary between measured, calculated, user-reported, AI-interpreted, stale, and unavailable output.
- [x] Map every existing screen to Today, Health, Move, You, contextual Coach, or secondary Log in `SCREEN_OWNERSHIP_MAP.md`.
- [x] Identify duplicate cards and routes without deleting behavior yet.
- [ ] Define deterministic fallback copy for every AI-assisted surface.

Exit criteria:

- Every current screen has one canonical owner.
- No health value changes meaning as a side effect of navigation or copy changes.
- The migration inventory identifies preserved redirects and back-navigation behavior.

## Phase 2 - Navigation and You migration

Estimated effort: 4-6 working days

- [x] Change the primary tabs to Today, Health, Move, and You.
- [x] Move account, goals, preferences, privacy, Health Connect controls, export, diagnostics, About, and settings into You.
- [x] Keep `/tabs/coach`, `/ai-coach`, `/tabs/settings`, and other legacy routes as tested compatibility routes.
- [x] Add contextual Coach entry points without duplicating chat history or starting unrelated data loads.
- [x] Preserve selected dates, scroll position, drafts, and originating-destination back navigation.

Exit criteria:

- Exactly four primary tabs are visible: Today, Health, Move, You.
- Existing notification, widget, deep-link, and internal navigation targets still land on a meaningful screen.
- Coach history and unfinished draft remain intact.

## Phase 3 - Today daily story

Estimated effort: 5-8 working days

- [x] Keep the first screen glanceable and answer body state, main shaping evidence, and one next action.
- [x] Keep Recovery, Sleep, Strain, and Energy as supporting evidence rather than introducing another unexplained score.
- [x] Separate evidence ranking from recommendation selection.
- [x] Show source, freshness, partial-data, stale, permission, empty, and error states without replacing valid previous content.
- [x] Keep setup questionnaires, long trends, record lists, and general chat out of the primary Today scroll.
- [x] Verify that Today remains understandable with AI disabled or unavailable.

Exit criteria:

- A tester can explain how they are today, what shaped it, and what to do next without opening a detail screen.
- Every visible claim traces to measured data, a tested calculation, an explicit user report, or labeled AI interpretation.
- Refresh preserves Last Known Good content and prevents stale responses from replacing newer state.

## Phase 4 - Health, Move, and contextual Coach consolidation

Estimated effort: 5-8 working days

- [x] Keep trends, baselines, evidence details, Health Calendar, nutrition, weight, fitness age, pain, and source quality under Health.
- [x] Keep recorded movement, planned training, weekly plan, race goals, and sport-specific tools under Move.
- [x] Remove duplicate summary cards when the canonical destination is discoverable within one action.
- [x] Make Coach prompts aware of the originating context without forcing race-focused guidance.
- [x] Preserve manual Log as a secondary fallback and retain preview/confirmation before saves.

Exit criteria:

- Health does not prescribe training and Move does not become a generic health dashboard.
- Coach can answer general health/recovery questions without defaulting to the active race goal.
- Existing workout, meal, sleep, plan, and race records render with unchanged meaning.

## Phase 5 - Coordinated display-name and logo release

Estimated effort: 3-5 working days

- [x] Change the Capacitor `appName` and Android user-facing app labels to `WholeMate`.
- [x] Replace launcher icon artwork, adaptive icon layers, splash branding, in-app logo, notification mark, share-card brand mark, and tester-facing release artwork.
- [x] Update visible brand references in onboarding, About, diagnostics, privacy copy, export labels, notifications, widgets, accessibility labels, and release notes.
- [x] Keep `appId`, Android application ID, package/namespace, signing identity, Firebase app, OAuth callback, deep-link scheme, and stored-data keys unchanged.
- [ ] Verify an update install over the latest RunMate tester build rather than testing only a clean install.

Exit criteria:

- The renamed build installs as an update over RunMate and retains session, settings, history, and cached state.
- Health Connect access and record visibility remain intact.
- No old user-facing RunMate branding remains except explicitly approved compatibility or legal text.
- The launcher, splash, status/notification treatment, widgets, share pictures, and in-app header are visually coherent.

## Phase 6 - Hardening and tester release

Estimated effort: 3-5 working days

- [ ] Run unit tests, lint, production web build, Capacitor sync, Android tests, signed APK build, signature verification, and permission inspection.
- [ ] Validate upgrade install, cold start, auth restore, Health Connect sync, Today refresh, tab switching, contextual Coach, manual Log, notifications, widget, export, and logout on the Samsung tester device.
- [ ] Validate Android Back, cold deep links, 200% font scaling, TalkBack order, touch targets, keyboard behavior, and scroll restoration.
- [ ] Compare release-like startup, first actionable Today content, tab response, and refresh feedback with the Phase 0 baseline.
- [ ] Distribute to the existing Firebase App Distribution application and tester group.

Exit criteria:

- The signed build is distributed through the existing application identity.
- Physical-device evidence confirms data continuity and core interaction behavior.
- Release notes explain the broader positioning without implying new medical capability.

## Estimated schedule

| Outcome | Expected effort |
| --- | ---: |
| Display-name/logo rebrand on the current experience | 3-5 working days after assets and name are approved |
| Repositioned beta with Today, Health, Move, You | 2-3 weeks |
| Full product-contract migration and tester hardening | 4-6 weeks |

These estimates assume the current application remains the production base, the Android application ID does not change, and no Compose rewrite, database migration, recovery-formula rewrite, or new provider integration is added to the same scope.

## Explicitly out of scope

- Changing `com.runmate.mobile`.
- Publishing a second Android application.
- Moving the production application to Compose during this roadmap.
- Rewriting Recovery or inventing Strain, HRV, respiratory rate, stress, or other missing measurements.
- Changing Supabase schemas solely for the rebrand.
- Deleting legacy routes before upgrade and deep-link validation.
- Adding new health features before the repositioned daily loop is validated.

## First executable slice

Complete Phase 0 and the Phase 1 screen-ownership map first. Do not change the installed name or logo until the new navigation, compatibility routes, update-install checklist, and final visual assets are ready for one coordinated tester release.

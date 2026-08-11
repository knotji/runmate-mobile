# RunMate Share Picture System

Status: Initial redesign implemented; physical-device visual validation pending
Scope: Presentation and export only
Primary output: transparent PNG overlay for Instagram Story

## Current implementation audit

### Entry points

- `RecoveryPage` opens the existing share modal with the current `CoachContext`.
- `WorkoutDetailPage` adapts the selected workout into `WorkoutShareData` and opens the same modal.
- `WeeklySummaryPage` and `WeeklyRecapPage` pass `WeeklyRecapHighlights` into the same modal.
- There is no separate Today / Body Status composition; the Today entry currently exports the Recovery design.

### Rendering and native export

- `SocialShareModal` draws directly into an HTML canvas and exports `canvas.toDataURL('image/png')`.
- Transparent themes clear the canvas and do not paint a full background, so the PNG contains real alpha transparency.
- Android uses the existing `StoryImagePlugin` to decode the PNG data URL and save it through `MediaStore` as `image/png` under `Pictures/RunMate`.
- Browser sharing uses the Web Share API when file sharing is supported and falls back to downloading or saving the PNG.
- The preview already has a checkerboard treatment for transparent assets.
- No DOM screenshot or DOM-to-image dependency is used.

### Existing formats and themes

- Portrait exports use `833 x 1579`, which is not an exact 9:16 ratio.
- Two workout themes use a `1579 x 833` landscape export.
- No square or feed-portrait export exists.
- Transparent output exists for workout overlay, horizontal workout overlay, weekly calendar, and monthly overlay.
- Recovery has only opaque dark/light themes.
- The current theme list mixes composition, orientation, background, and visual style in one enum.

### Existing data contracts

- Workout shares can receive type, distance, duration, pace, average HR, calories, elevation, and date.
- Workout metric availability is already filtered so absent numeric values are omitted.
- Recovery shares read Recovery, sleep duration, and Strain from the existing recovery system.
- Weekly shares use already-derived recap highlights: Recovery average, best Sleep score, adherence, sessions, distance, active time, active dates, and training mix.
- Energy Reserve and the existing Today interpretation layer are not currently represented.
- Route coordinates are not part of the share contract, so a Route layout must remain unavailable rather than fabricating a path.

## Problems to solve

1. `SocialShareModal` combines modal state, data adaptation, canvas primitives, every composition, native save, and browser sharing in one large file.
2. The portrait canvas ratio and CSS preview ratio disagree, allowing preview cropping; one footer is positioned below the portrait canvas.
3. Workout, Recovery, and Recap exports do not share a recognizable RunMate composition system.
4. Recovery is gauge-first and does not lead with the body-state interpretation already available in the app.
5. Transparent support is inconsistent across export types.
6. Existing transparent workout text depends mostly on shadow over arbitrary photos instead of bounded local contrast surfaces.
7. Theme names describe colors rather than meaningful layouts, making the control harder to understand.

## Proposed RunMate identity

### Body Flow

Use a restrained continuous curve with three soft nodes as RunMate's recurring motif. The path changes by content type:

- Workout: forward movement with a rising exit.
- Recovery: a resting loop around the hero state.
- Today: a balanced transition from state to action.
- Recap: a progression curve across the composition.

Body Flow is decorative. It must never be described as a scientific graph or imply that its geometry is calculated from health values.

The supporting identity uses rounded asymmetric surfaces, teal/blue body-health accents, bold numeric typography, small metric capsules, and a compact `RUNMATE` signature. It deliberately avoids Strava-like typography, four equal WHOOP-style gauges, and generic full-screen glass cards.

## Layouts

All initial layouts export at an exact `1080 x 1920` Story ratio.

### Minimal

- One dominant result or score.
- One clear state or workout title.
- Up to three compact supporting metrics.
- Best for placing near the lower or central area of a photo.

### Stack

- A vertical reading order with the hero first and supporting metrics below.
- Uses separate local contrast surfaces rather than one full opaque panel.
- Suitable for photos with the subject positioned to one side.

### Signature

- The most recognizable RunMate composition.
- Uses an asymmetric hero surface and a more visible Body Flow motif.
- Keeps metrics subordinate to the state or primary result.

### Route

Deferred. It becomes available only when trustworthy route coordinates are present in the workout share contract and have been validated on a physical device.

## Component and data architecture

- `shareComposition.ts`
  - Common content model.
  - Workout, Recovery, Today, and Recap adapters.
  - Uses existing interpretation and formula outputs without recalculating health data.
- `shareCanvasRenderer.ts`
  - Shared canvas primitives, design tokens, local contrast surfaces, typography, brand signature, and Body Flow motif.
  - Implements Minimal, Stack, and Signature.
- `SocialShareModal.tsx`
  - Modal lifecycle, preview, constrained controls, metric selection, save, and share only.
- `workoutShareMetrics.ts`
  - Sport-aware metric availability and ordering, including optional RunMate Load.
- Existing `storyImage.ts` and Android `StoryImagePlugin`
  - Reused without changing storage permissions or native save behavior.

## Transparent PNG strategy

- Clear the full canvas before every render.
- In transparent mode, never paint a full-canvas rectangle.
- Use alpha-backed local hero and metric surfaces only where text needs protection.
- Provide Light and Dark text treatments so the user can match the photograph.
- Keep a checkerboard preview and label the output as `Transparent PNG`.
- Offer an optional soft full-canvas background for users who want a ready-to-post image without a photo.
- Wait for document fonts before rendering when the browser exposes `document.fonts.ready`.

## Accessibility and readability

- Layout, treatment, and background controls use visible labels and pressed-state semantics.
- All controls retain at least a 44 CSS pixel target.
- Critical information is communicated with text, not color alone.
- Text uses local contrast surfaces, restrained shadow, and fitted/wrapped typography.
- The preview has an export-specific alternative description and generation state.
- Missing metrics are omitted; no dash or placeholder is promoted as a result.

## Migration and risks

- Existing saved PNGs are unaffected.
- The native plugin and Health Connect permissions remain unchanged.
- The initial redesign standardizes on Story output; the old landscape workout option is intentionally not presented as an Instagram feed format.
- Canvas font rendering can differ between WebView versions, so fitted typography and physical-device checks remain required.
- Some receiving apps flatten transparent PNGs onto black. The UI must explain that the file is intended as an overlay and keep Save as a reliable fallback.
- Route sharing remains gated on real route data.
- No Supabase schema, health record, Recovery, Sleep, Strain, Energy Reserve, training-plan, or ingestion logic changes are authorized by this work.

## Implemented in this iteration

- Standardized every new export on an exact `1080 x 1920` canvas.
- Added Minimal, Stack, and Signature layouts for Workout, Recovery, Today, and weekly/monthly Recap content.
- Recovery uses a compact score-first overlay: one primary Recovery ring, two small Sleep/Strain rings, and no explanatory paragraph. The Story canvas remains full-size so placement is stable over a photo.
- Added Light/Dark text treatments independently from Transparent/Soft Canvas backgrounds.
- Added the decorative Body Flow motif and a consistent RunMate signature.
- Added a Today/Recovery content selector to the Today share entry point.
- Reused the existing Today brief and adaptive-plan interpretation rather than introducing share-only health logic.
- Added current Energy Reserve when it is genuinely available.
- Added sport-aware workout metric selection and optional RunMate Load.
- Kept missing metrics absent and kept Route unavailable without real route coordinates.
- Reused the existing PNG, Web Share, Android MediaStore, and Pictures/RunMate pipeline.
- Preview rendering now uses PNG `Blob` and a revocable Object URL instead of retaining a Base64 image in React state.
- A bounded six-entry render cache avoids regenerating recently selected combinations, rapid option changes are coalesced by the existing animation-frame scheduling, and the loading indicator is reserved for the first preview.
- Base64 conversion now occurs only at the Android native-save boundary. Browser share and download use the Blob directly.
- `share_render` and `share_export` diagnostics record recent render/export latency without blocking the export flow.

## Verification

- Focused social-share unit tests: passed.
- Full unit suite: 113 files and 498 tests passed.
- ESLint: passed.
- TypeScript and production Vite build: passed.
- Capacitor Android sync: passed.
- Android `compileDebugKotlin`: passed.
- Physical Android inspection remains required for typography, photo contrast, receiving-app alpha behavior, and Story placement.

# RunMate Interaction Audit

Date: 2026-07-28  
Scope: Bottom Tabs, Recovery, and Activity  
Method: Static interaction-path review. Real-device timing and visual checks remain explicitly listed below because an interactive browser was unavailable in this session.

## Audit Standard

- **Response:** visible or haptic acknowledgement should begin within 100 ms.
- **Loading:** work lasting longer than 300 ms needs local, action-specific progress.
- **Stability:** keep trustworthy cached content visible; avoid layout shifts and full-page reloads.
- **Completion:** pending actions must finish, fail visibly, and remain retryable.
- **Touch:** interactive targets should be at least 44 × 44 px.

Severity meanings:

- **Blocker:** prevents a primary flow or risks destructive behavior.
- **High:** regularly leaves an action stuck or makes its result unclear.
- **Medium:** noticeable delay, misleading state, or avoidable repeat work.
- **Low:** polish, accessibility, or uncommon edge case.

## Findings

### IA-01 — Activity / Pull To Refresh Can Remain Stuck

- **Status:** Resolved in source on 2026-07-28; device verification pending.
- **Evidence:** Static code finding.
- **Observed behavior:** The Activity refresher calls Health Connect sync and then reloads records before calling `event.detail.complete()`. Unlike Recovery, this path has no `try/finally`.
- **Severity:** High.
- **Cause:** A thrown sync or records request exits the handler before the refresher is completed.
- **Recommended fix:** Wrap the complete refresh operation in `try/finally`, always call `event.detail.complete()`, and expose a local retryable error without removing saved records.
- **Verification:** Force Health Connect or Supabase to reject, pull to refresh, and confirm the spinner stops and the current records remain visible with an error action.

### IA-02 — Activity / Previous And Next Date Add A Forced Delay

- **Status:** Resolved in source on 2026-07-28; device verification pending.
- **Evidence:** Static code finding.
- **Observed behavior:** Every date-arrow action enters `dateLoading`, waits 200 ms with `setTimeout`, and only then changes the selected date even though filtering the records is synchronous.
- **Severity:** Medium.
- **Cause:** Artificial delay in `moveToDate()`.
- **Recommended fix:** Change the selected date immediately. Only show loading when the requested date requires an actual archive request; keep arrows disabled only while that request is pending.
- **Verification:** Tap previous/next repeatedly. The date label and records should update in the same frame, with no blank or spinner for locally available dates.

### IA-03 — Recovery / Share Availability Does Not Match Visible Cached Data

- **Status:** Resolved in source on 2026-07-28; device verification pending.
- **Evidence:** Static code finding.
- **Observed behavior:** Recovery can render `startupRecovery` and `startupContext` immediately, but Share is disabled until the live Zustand `context` exists.
- **Severity:** Medium.
- **Cause:** The button checks `!context` instead of the same resolved visible context used by the page.
- **Recommended fix:** Enable Share when the resolved visible context contains the required share values. If sharing truly requires refreshed data, show that reason beside the action.
- **Verification:** Cold-open Recovery with a valid same-day cache and slow network. The visible score should be shareable immediately and the resulting story must match the visible values.

### IA-04 — Bottom Tabs / First Visit Can Replace The Whole Page With A Generic Route Skeleton

- **Evidence:** Static code finding; perceived severity requires device verification.
- **Observed behavior:** All four tab pages are lazy-loaded. A first visit uses a full route loading screen rather than preserving the tab shell with a local content placeholder.
- **Severity:** Medium.
- **Cause:** No idle prefetch for the remaining main-tab chunks; `Suspense` falls back at route level.
- **Recommended fix:** After the initial tab becomes interactive, prefetch the other main-tab chunks during idle time. Keep the bottom tab bar stable throughout the first transition.
- **Verification:** On a clean install or cleared WebView cache, open each tab once. Confirm the selected tab responds immediately, the bar does not disappear or jump, and content loading is localized.

### IA-05 — Activity / First Cached Load Performs A Silent Follow-Up Records Query

- **Evidence:** Static code finding; user impact requires device verification.
- **Observed behavior:** Same-day cached records render immediately. After the 1.2-second background health check, Activity reloads recent cloud history once when `startupCacheUsedRef` is still true, even if Health Connect reports no changes.
- **Severity:** Low.
- **Cause:** Startup-cache freshness is resolved through a delayed unconditional follow-up query.
- **Recommended fix:** Keep the freshness check, but ensure it cannot reorder or flash the list. Consider starting the cloud validation during idle time and record whether the returned fingerprint actually differs before replacing UI state.
- **Verification:** Open Activity repeatedly with unchanged data and a throttled network. Confirm there is no row movement, count flicker, scroll reset, or unexpected skeleton.

### IA-06 — Recovery / Secondary Retry Target Is Below The App Touch Standard

- **Evidence:** Static CSS finding.
- **Observed behavior:** The secondary Recovery retry button uses a 36 px minimum height.
- **Severity:** Low.
- **Cause:** Component-specific sizing overrides the shared 44 px touch-target standard.
- **Recommended fix:** Raise the interactive box to at least 44 px while retaining the compact visual treatment.
- **Verification:** Inspect the rendered hit box at 360–390 px widths and test one-handed tapping.

## What Is Already Working Well

- Bottom tabs provide immediate haptic acknowledgement.
- Recovery preserves same-day cached scores and guidance while background refreshes run.
- Recovery pull-to-refresh always completes through `try/finally`.
- Health sync deduplicates concurrent work and uses a three-minute foreground cooldown.
- Activity prevents duplicate recent/archive loads and disables date controls during their pending state.
- Activity row and delete actions are separate, labelled controls; deletion requires confirmation and shows per-row progress.
- Primary Activity date controls meet the 44 px touch-target standard.
- Recovery animations already respect `prefers-reduced-motion`.

## Recommended Fix Order

1. Fix Activity refresher completion (`IA-01`).
2. Remove the forced date delay (`IA-02`).
3. Align Recovery Share availability with visible cached data (`IA-03`).
4. Verify cold tab transitions on device, then add idle chunk prefetch if the full-screen fallback is visible (`IA-04`).
5. Address the low-severity stability and touch polish (`IA-05`, `IA-06`).

## Real-Device Verification Checklist

Run once with normal connectivity and once with network throttling or offline mode:

- Cold-open each bottom tab and record time to selected-state, haptic response, and stable content.
- Double-tap each bottom tab; confirm there is no duplicate navigation or stacked page.
- Return to Recovery from Sleep Detail, Recovery Trends, and Sleep Window; confirm there is no unnecessary full skeleton.
- Cold-open Recovery with a same-day cache; test Share before background refresh finishes.
- Pull Recovery and Activity to refresh while online, offline, and with Health Connect unavailable.
- Tap Activity previous/next rapidly and confirm labels, records, and disabled states stay synchronized.
- Open the Activity calendar before and after archive data is loaded; confirm the modal communicates loading and retry locally.
- Open and return from meal, workout, and sleep details; confirm Activity keeps its selected date and scroll position.
- Delete one Activity record, cancel once, confirm once, and simulate a failed delete.
- Check all actions at 360 px width, large font/display scaling, and reduced-motion mode.

## Exit Criteria

The audited scope is ready when:

- no pending action can remain visually stuck;
- cached content never disappears for a background refresh;
- local date and tab selections update immediately;
- work over 300 ms has local progress and retry behavior;
- repeated taps cannot create duplicate operations;
- device verification finds no navigation jump, scroll reset, or layout shift.

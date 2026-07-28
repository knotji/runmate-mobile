# Performance Budget And Accessibility Audit

Date: 2026-07-29

## Performance Budget

RunMate now evaluates the rolling five-sample average for each measured local data phase against an explicit device-side budget.

| Work | Budget |
| --- | ---: |
| Small local derivation | 100 ms |
| Detail or local preference load | 1,500 ms |
| Core page data and Health Connect sync | 2,500 ms |
| Secondary, archive, or broad history load | 4,000 ms |

Network-bound destructive operations, exports, and AI answers are measured but do not receive a fixed budget because their latency is primarily external.

The Health Test diagnostics card reports `Within` or `Over` beside each applicable phase. Budgets are observability thresholds; they never block or fail a user action.

## Confirmed Performance Fix

Sleep Detail previously added an artificial 240 ms delay when moving between already-loaded nights. Night selection is now synchronous, while the initial cloud load retains its structured skeleton.

## Accessibility Results

- Structured page skeletons expose `role=status`, polite announcements, and `aria-busy=true`.
- Activity record actions have explicit open/delete names.
- Activity deletion exposes its busy state and announces errors as alerts.
- Decorative Activity icons are hidden from assistive technology.
- Activity, Sleep Detail, and upload date pickers announce their selected date and purpose.
- Existing period controls retain pressed, busy, live-region, and disabled states.
- Existing page-level error components retain assertive alert semantics.

## Follow-up Test Guidance

Before a store release, run TalkBack on Android over the four primary tabs and verify large-text layout at the device's largest font setting. Automated semantics protect the DOM contract, but they cannot replace device-level reading order and touch-target review.

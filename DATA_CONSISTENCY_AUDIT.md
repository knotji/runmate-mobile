# Data Consistency Audit

Date: 2026-07-29

## Scope

- Recovery and Sleep Coach
- Training Summary and shared recap
- Activity list and workout detail
- Startup cache and background refresh

## Results

### Recovery and Sleep Coach

Pass. Recovery, Sleep Window, and bedtime notifications use the same sleep-need, wake-time, and cycle-plan calculations.

The wake-time plan is account-backed. The optional cycle override is intentionally stored on the current device for tonight only, so it does not follow the user to another device.

### Training Summary and Share

Pass. The visible calendar summary and shared recap use `buildPeriodTrainingSummary` as the common source for sessions, distance, active time, active days, and training mix.

### Activity and Workout Detail

Fixed. Health Connect can provide workout duration as `activeDurationSeconds` without a preformatted `duration` string. Previously this could make the same workout lose its duration in Activity, Workout Detail, Recovery context, or Training Summary.

All four paths now use the same duration normalization and preserve an existing display duration when one is supplied.

### Cache and Background Refresh

Pass.

- Recovery and Activity startup snapshots are accepted only for the current Bangkok date.
- Weekly Summary's in-memory snapshot expires after five minutes.
- Cached content is replaced after the authoritative cloud load completes.
- Activity reloads after background Health Connect sync when records changed, and also replaces its startup-only snapshot after the first sync check.

## Regression Coverage

- Supplied workout duration remains unchanged.
- Health Connect active seconds are normalized to minutes and clock text.
- Manual strength duration continues to use minute fields.
- Workout Detail displays the normalized Health Connect duration.
- Calendar Summary and Share continue to use the shared period aggregator.

import { describe, expect, it } from 'vitest';
import { buildCoachContext } from '@/lib/buildCoachContext';
import { buildSleepDiagnostics } from '@/lib/sleepDiagnostics';

describe('sleep diagnostics', () => {
  it('reports missing coverage without fabricating values', () => {
    const diagnostics = buildSleepDiagnostics(buildCoachContext());

    expect(diagnostics.latest).toBeNull();
    expect(diagnostics.coverage.every((item) => !item.available)).toBe(true);
    expect(diagnostics.warnings).toContain('No sleep record is available in the last 30 days.');
  });

  it('builds coverage from the selected historical night', () => {
    const context = buildCoachContext();
    context.sleepBaseline30d = [
      {
        date: context.todayDate, durationH: null, durationMinutes: 420, score: 82, readiness: null,
        restingHR: 52, restingHRSource: 'estimated_sleep_hr', hrv: 48, energyScore: null, sleepStartTime: '22:30', sleepEndTime: '05:45',
        timeInBedMinutes: 435, respiratoryRate: 14.2, awakeMinutes: 15, remMinutes: 90,
        lightMinutes: 230, deepMinutes: 85,
      },
      {
        date: '2026-07-17', durationH: null, durationMinutes: 360, score: 70, readiness: null,
        restingHR: null, hrv: null, energyScore: null, sleepStartTime: null, sleepEndTime: null,
        timeInBedMinutes: 400, respiratoryRate: null, awakeMinutes: null, remMinutes: null,
        lightMinutes: null, deepMinutes: null,
      },
    ];
    context.sleepHistory = context.sleepBaseline30d;

    const diagnostics = buildSleepDiagnostics(context, '2026-07-17');

    expect(diagnostics.latest?.date).toBe('2026-07-17');
    expect(diagnostics.coverage.find((item) => item.label === 'Sleep Duration')?.value).toBe('6h 0m');
    expect(diagnostics.coverage.find((item) => item.label === 'Sleep Stages')?.available).toBe(false);
    expect(diagnostics.warnings.some((warning) => warning.includes('not today'))).toBe(false);
  });

  it('labels a sleep-window RHR estimate honestly', () => {
    const context = buildCoachContext();
    context.sleepBaseline30d = [{
      date: context.todayDate, durationH: null, durationMinutes: 420, score: null, readiness: null,
      restingHR: 54, restingHRSource: 'estimated_sleep_hr', hrv: null, energyScore: null,
      sleepStartTime: '22:30', sleepEndTime: '05:30', timeInBedMinutes: 420,
      respiratoryRate: null, awakeMinutes: null, remMinutes: null, lightMinutes: null, deepMinutes: null,
    }];
    context.sleepHistory = context.sleepBaseline30d;

    const item = buildSleepDiagnostics(context).coverage.find((entry) => entry.label === 'Resting Heart Rate');
    expect(item).toMatchObject({ available: true, value: '54 bpm', note: 'Estimated from sleep HR samples' });
  });
});

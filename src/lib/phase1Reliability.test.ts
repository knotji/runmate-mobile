import { describe, expect, it } from 'vitest';
import { formatReconciliationSyncError, isReconciliationPermissionError } from './reconciliationPolicy';
import { buildSupportCards } from './recoverySupport';
import { buildCoachContextFromData } from './buildCoachContext';
import { buildRecoveryCoreContextFromSupabase, invalidateCoachContextCache } from './coachContextService';

describe('Phase 1 Data Reliability & Reconciliation Helpers', () => {
  it('detects permission errors correctly', () => {
    expect(isReconciliationPermissionError(new Error('Permission denied by user'))).toBe(true);
    expect(isReconciliationPermissionError(new Error('READ_HEALTH_DATA not authorized'))).toBe(true);
    expect(isReconciliationPermissionError('unauthorized access')).toBe(true);
    expect(isReconciliationPermissionError(new Error('Network timeout'))).toBe(false);
    expect(isReconciliationPermissionError(null)).toBe(false);
  });

  it('formats sync errors into user-friendly copy', () => {
    expect(formatReconciliationSyncError(new Error('Permission denied'))).toContain('Health Connect permission is required');
    expect(formatReconciliationSyncError(new Error('Device unavailable'))).toBe('Device unavailable');
    expect(formatReconciliationSyncError(null, 'Default error')).toBe('Default error');
  });
});

describe('Phase 1 Support Cards Calibration Information', () => {
  it('surfaces baseline calibration information when score state is calibrating', () => {
    const context = buildCoachContextFromData({
      items: [
        {
          id: 'sleep-1',
          type: 'sleep',
          createdAt: new Date().toISOString(),
          dateKey: '2026-07-22',
          data: {
            extracted: {
              date: '2026-07-22',
              sleepDuration: '7h 0m',
              actualSleepDurationMinutes: 420,
              timeInBedMinutes: 450,
            },
          },
        },
      ],
      profile: null,
      raceGoal: null,
      racePlan: null,
      raceResults: [],
    });

    const cards = buildSupportCards(context);
    const dataCard = cards.find((card) => card.category === 'data');
    expect(dataCard).toBeDefined();
    if (context.recoverySystem.scoreState === 'calibrating') {
      expect(dataCard?.title).toBe('Recovery Is Still Calibrating');
      expect(dataCard?.summary).toContain('Baseline calibration matures over 14 nights.');
    }
  });
});

describe('Phase 1 CoachContext Offline Fallback', () => {
  it('safely handles offline errors without throwing unhandled exceptions', async () => {
    invalidateCoachContextCache();
    const context = await buildRecoveryCoreContextFromSupabase();
    expect(context).toBeDefined();
    expect(context.recoverySystem).toBeDefined();
    expect(context.recoverySystem.overallScore).toBeGreaterThanOrEqual(0);
  });
});

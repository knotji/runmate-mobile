import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { dedupeWorkoutItems } from './workoutDedupe';

function item(id: string, provider: 'samsung_health' | 'generic_image', extracted: Record<string, unknown>, coach: Record<string, unknown> = {}): LocalHistoryItem {
  return { id, type: 'workout', createdAt: '2026-07-18T03:32:00Z', dateKey: '2026-07-18', source: { provider, importType: provider === 'samsung_health' ? 'health_connect' : 'image', importedAt: '2026-07-18T04:00:00Z' }, data: { extracted, coach } };
}

describe('workout reconciliation', () => {
  it('uses Samsung measured metrics and preserves upload-only AI detail', () => {
    const upload = item('upload', 'generic_image', { workoutKind: 'outdoor_run', duration: '1:00:00', distanceKm: 10.2, vo2Max: 47.7, sweatLossMl: 870 }, { workoutSummary: 'Strong aerobic session' });
    const samsung = item('healthconnect-samsung-workout-run', 'samsung_health', { workoutKind: 'outdoor_run', duration: '1:00:00', distanceKm: 10.16, avgHR: 169, maxHR: 187, vo2Max: null });
    const [merged] = dedupeWorkoutItems([upload, samsung]);
    const data = merged.data as { extracted: Record<string, unknown>; coach: Record<string, unknown> };
    expect(merged.id).toBe(samsung.id);
    expect(data.extracted).toMatchObject({ distanceKm: 10.16, avgHR: 169, vo2Max: 47.7, sweatLossMl: 870 });
    expect(data.coach.workoutSummary).toBe('Strong aerobic session');
    expect(merged.reconciledSources).toEqual(['Samsung Health', 'Upload']);
  });

  it('does not merge two materially different same-day runs', () => {
    const shortRun = item('short', 'generic_image', { workoutKind: 'outdoor_run', duration: '20:00', distanceKm: 3 });
    const longRun = item('long', 'samsung_health', { workoutKind: 'outdoor_run', duration: '1:00:00', distanceKm: 10 });
    expect(dedupeWorkoutItems([shortRun, longRun])).toHaveLength(2);
  });

  it('reconciles the uploaded and Samsung versions of the same outdoor run', () => {
    const upload = item('upload-run', 'generic_image', { workoutKind: 'outdoor_run', duration: '1:00:00', distanceKm: 10.2, avgHR: 170 });
    const samsung = item('samsung-run', 'samsung_health', { workoutKind: 'outdoor_run', duration: '1:01:29', distanceKm: 10.16, avgHR: 166 });
    const [merged] = dedupeWorkoutItems([upload, samsung]);
    expect(merged.sourceRecordIds).toEqual(expect.arrayContaining(['upload-run', 'samsung-run']));
  });

  it('reconciles a legacy Other upload with the matching typed Samsung workout', () => {
    const upload = item('upload-swim', 'generic_image', { workoutKind: 'other', workoutName: 'Other', duration: '21:15', distanceKm: '0.2' });
    const samsung = item('samsung-swim', 'samsung_health', { workoutKind: 'swimming', workoutName: 'Swimming', duration: '21:15', distanceM: 200 });
    const [merged] = dedupeWorkoutItems([upload, samsung]);
    expect(merged.sourceRecordIds).toEqual(expect.arrayContaining(['upload-swim', 'samsung-swim']));
    expect((merged.data as { extracted: Record<string, unknown> }).extracted.workoutKind).toBe('swimming');
  });

  it('keeps materially different Other and typed sessions separate', () => {
    const upload = item('upload-other', 'generic_image', { workoutKind: 'other', duration: '20:00' });
    const samsung = item('samsung-strength', 'samsung_health', { workoutKind: 'strength', duration: '45:00' });
    expect(dedupeWorkoutItems([upload, samsung])).toHaveLength(2);
  });
});

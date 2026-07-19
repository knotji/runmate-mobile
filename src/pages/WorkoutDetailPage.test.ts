import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutDetail } from '@/lib/workoutDetail';

describe('workout detail presentation', () => {
  it('shows only workout metrics present in the source record', () => {
    const item: LocalHistoryItem = {
      id: 'workout-1', type: 'workout', createdAt: '2026-07-18T08:00:00.000Z',
      source: { provider: 'garmin_connect', importType: 'csv', importedAt: '2026-07-18T08:05:00.000Z' },
      data: { extracted: { workoutKind: 'outdoor_run', distanceKm: 5.2, duration: '30:00', avgHR: null }, coach: { workoutSummary: 'Steady aerobic run.' } },
    };

    const detail = buildWorkoutDetail(item);

    expect(detail.title).toBe('Outdoor Run');
    expect(detail.metrics).toEqual([{ label: 'Distance', value: '5.2 km' }, { label: 'Duration', value: '30:00' }]);
    expect(detail.metrics.some((metric) => metric.label === 'Average HR')).toBe(false);
    expect(detail.source).toBe('Garmin Connect');
  });

  it('maps strength exercises from a strength log', () => {
    const item: LocalHistoryItem = {
      id: 'strength-1', type: 'strength', createdAt: '2026-07-17T08:00:00.000Z',
      data: { routineName: 'Runner Strength', durationMin: 35, intensity: 'moderate', exercises: [{ name: 'Squat', sets: 3, reps: '10' }] },
    };

    const detail = buildWorkoutDetail(item);

    expect(detail.isStrength).toBe(true);
    expect(detail.metrics).toContainEqual({ label: 'Duration', value: '35 min' });
    expect(detail.exercises).toEqual([{ name: 'Squat', detail: '3 sets · 10 reps' }]);
  });

  it('uses swimming units and metrics for a pool workout', () => {
    const item: LocalHistoryItem = {
      id: 'swim-1', type: 'workout', createdAt: '2026-07-17T13:15:00.000Z',
      data: { extracted: { workoutKind: 'swimming', swimKind: 'pool', distanceM: 200, duration: '21:15', avgPace: '6:39/100 m', poolLengthM: 25, totalLengths: 8, totalStrokes: 57, avgSwolf: 106, bestSwolf: 24 } },
    };

    const detail = buildWorkoutDetail(item);

    expect(detail.title).toBe('Pool Swim');
    expect(detail.metrics).toContainEqual({ label: 'Distance', value: '200 m' });
    expect(detail.metrics).toContainEqual({ label: 'Average SWOLF', value: '106' });
  });

  it('presents an uploaded circuit workout as strength training', () => {
    const item: LocalHistoryItem = {
      id: 'circuit-1', type: 'workout', createdAt: '2026-07-12T06:54:00.000Z',
      data: { extracted: { workoutKind: 'strength', workoutName: 'Circuit Training', duration: '39:34', avgHR: 95, maxHR: 120, calories: 226 } },
    };

    const detail = buildWorkoutDetail(item);

    expect(detail.isStrength).toBe(true);
    expect(detail.title).toBe('Circuit Training');
    expect(detail.metrics).toContainEqual({ label: 'Average HR', value: '95 bpm' });
    expect(detail.metrics.some((metric) => metric.label === 'Distance')).toBe(false);
  });

  it('shows the AI coach summary for a strength workout uploaded from a screenshot', () => {
    const item: LocalHistoryItem = {
      id: 'strength-upload-1', type: 'workout', createdAt: '2026-07-19T06:54:00.000Z',
      data: {
        extracted: { workoutKind: 'strength', workoutName: 'Weight Machines', duration: '39:41', avgHR: 110, maxHR: 136, calories: 272 },
        coach: { workoutSummary: 'บันทึกแล้ว ออกแรงกลุ่มกล้ามเนื้อหลัก', intensityAssessment: 'ปานกลาง', coachNote: 'พักกล้ามเนื้อ 48 ชม.ก่อนซ้อมซ้ำ' },
      },
    };

    const detail = buildWorkoutDetail(item);

    expect(detail.isStrength).toBe(true);
    expect(detail.insights).toContainEqual({ label: 'Summary', value: 'บันทึกแล้ว ออกแรงกลุ่มกล้ามเนื้อหลัก' });
    expect(detail.insights).toContainEqual({ label: 'Coach Note', value: 'พักกล้ามเนื้อ 48 ชม.ก่อนซ้อมซ้ำ' });
  });
});

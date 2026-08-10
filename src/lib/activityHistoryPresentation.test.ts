import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { describeHistoryItem, groupActivityRecords } from './activityHistoryPresentation';

const item = (id: string, type: LocalHistoryItem['type']): LocalHistoryItem => ({
  id, type, createdAt: '2026-08-05T12:00:00.000Z', dateKey: '2026-08-05', data: {},
});

describe('activity record groups', () => {
  it('groups a busy day into compact sections without changing item order', () => {
    const groups = groupActivityRecords([
      item('run', 'workout'), item('walk', 'workout'), item('meal', 'meal'), item('night', 'sleep'), item('pain', 'pain'),
    ]);
    expect(groups.map((group) => [group.key, group.items.length])).toEqual([
      ['training', 2], ['nutrition', 1], ['sleep', 1], ['health', 1],
    ]);
    expect(groups[0].items.map((entry) => entry.id)).toEqual(['run', 'walk']);
  });

  it('omits empty sections', () => {
    expect(groupActivityRecords([item('meal', 'meal')]).map((group) => group.key)).toEqual(['nutrition']);
  });

  it('keeps run, walk, strength, and other workout records independently visible', () => {
    const workouts: LocalHistoryItem[] = [
      { ...item('run', 'workout'), data: { extracted: { workoutKind: 'outdoor_run' } } },
      { ...item('walk', 'workout'), data: { extracted: { workoutKind: 'walk' } } },
      { ...item('strength', 'strength'), data: { extracted: { workoutKind: 'strength_training' } } },
      { ...item('cycling', 'workout'), data: { extracted: { workoutKind: 'cycling' } } },
    ];

    const training = groupActivityRecords(workouts)[0];
    expect(training.items.map((entry) => entry.id)).toEqual(['run', 'walk', 'strength', 'cycling']);
    expect(workouts.map((entry) => describeHistoryItem(entry).title)).toEqual(['Outdoor Run', 'Walk', 'Strength Training', 'Cycling']);
  });
});

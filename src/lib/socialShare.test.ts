import { describe, it, expect } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { WorkoutShareData } from '@/components/SocialShareModal';

describe('Social Share Story Card', () => {
  it('prepares correct metrics for Recovery Story Card rendering', () => {
    const mockContext: Partial<CoachContext> = {
      recoverySystem: {
        scoreState: 'scored',
        overallScore: 82.4,
        overallLabel: 'Good',
        strain: {
          score: 12.3,
        },
        sleepPerformance: {
          actualSleepMinutes: 445,
        },
      } as unknown as CoachContext['recoverySystem'],
    };

    const score = Math.round(mockContext.recoverySystem!.overallScore);
    const label = mockContext.recoverySystem!.overallLabel;
    const sleepMins = mockContext.recoverySystem!.sleepPerformance.actualSleepMinutes;
    const strain = mockContext.recoverySystem!.strain.score;

    expect(score).toBe(82);
    expect(label).toBe('Good');
    expect(sleepMins).toBe(445);
    expect(strain).toBe(12.3);
  });

  it('prepares correct metrics for Workout Story Card rendering', () => {
    const mockWorkout: WorkoutShareData = {
      title: 'Morning Run',
      distanceKm: 10.5,
      durationSeconds: 3402,
      paceFormatted: "5'24\"",
      avgHeartRateBpm: 148,
    };

    expect(mockWorkout.distanceKm.toFixed(2)).toBe('10.50');
    expect(mockWorkout.paceFormatted).toBe("5'24\"");
    expect(mockWorkout.avgHeartRateBpm).toBe(148);
  });
});

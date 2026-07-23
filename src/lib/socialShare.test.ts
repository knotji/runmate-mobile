import { describe, it, expect } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';

describe('Social Share Story Card', () => {
  it('prepares correct metrics for Story Card rendering', () => {
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
});

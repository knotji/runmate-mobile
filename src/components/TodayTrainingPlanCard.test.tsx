import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import { TodayTrainingPlanCard } from '@/components/TodayTrainingPlanCard';
import type { RacePlan } from '@/types/race';

const racePlan: RacePlan = {
  raceCountdownText: '',
  totalWeeks: 1,
  currentPhase: 'Build',
  planSummary: '',
  phases: [],
  weeks: [],
  safetyNotes: '',
  weeklyPlan: [{
    day: 'Monday',
    workoutType: 'Intervals',
    distanceKm: 8,
    durationMin: 60,
    targetPace: '5:00–5:30 min/km',
    targetHR: 'Zone 4',
    description: 'Hard interval session',
  }],
};

function moderateContext(): CoachContext {
  return {
    racePlan,
    todayDate: '2026-07-20',
    todayWorkouts: [],
    todayPrimaryWorkout: null,
    activePain: false,
    activeSick: false,
    latestSick: null,
    recoverySystem: {
      overallScore: 55,
      scoreState: 'scored',
      dataFreshness: { status: 'today' },
      strain: { score: 3 },
      sleepPerformance: { score: 80, state: 'scored' },
      fuelInsight: { status: 'ready' },
    },
  } as unknown as CoachContext;
}

describe('TodayTrainingPlanCard adaptive flow', () => {
  it('shows the reduced workout immediately without changing the Race Plan', () => {
    render(<TodayTrainingPlanCard context={moderateContext()} />);

    expect(screen.getByText('Adaptive · Reduce')).toBeInTheDocument();
    expect(screen.getByText('5.5 km · 40 min · Easy Conversational Pace · Zone 1–2')).toBeInTheDocument();
    expect(screen.getByText('Original Plan: Intervals')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review Adjustment|Apply For Today/ })).not.toBeInTheDocument();
    expect(racePlan.weeklyPlan?.[0].distanceKm).toBe(8);
  });
});

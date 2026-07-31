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
    sleep7d: [{
      date: '2026-07-20',
      durationH: '7h',
      durationMinutes: 420,
      score: 78,
      readiness: null,
      restingHR: 54,
      hrv: 58,
      energyScore: null,
      sleepStartTime: null,
      sleepEndTime: null,
      timeInBedMinutes: 450,
      respiratoryRate: null,
      awakeMinutes: 30,
      remMinutes: null,
      lightMinutes: null,
      deepMinutes: null,
    }],
    sleepHistory: [],
    sleepBaseline30d: [],
    mealsToday: [],
    recoverySystem: {
      overallScore: 55,
      scoreState: 'scored',
      dataFreshness: { status: 'today' },
      strain: { score: 3 },
      sleepPerformance: { score: 80, state: 'scored', actualSleepMinutes: 420, sleepNeedMinutes: 420 },
      fuelInsight: { status: 'ready' },
    },
  } as unknown as CoachContext;
}

describe('TodayTrainingPlanCard adaptive flow', () => {
  it('turns Recovery into a three-part brief without changing the Race Plan', () => {
    render(<TodayTrainingPlanCard context={moderateContext()} />);

    expect(screen.getByLabelText("Today's Brief")).toBeInTheDocument();
    expect(screen.getByText('Adaptive · Reduce')).toBeInTheDocument();
    expect(screen.getByText('Body Readiness')).toBeInTheDocument();
    expect(screen.getByText('Likely Limiter')).toBeInTheDocument();
    expect(screen.getByText('One Adjustment')).toBeInTheDocument();
    expect(screen.getByText('Reduce Today’s Load')).toBeInTheDocument();
    expect(screen.getByText(/\d key signals?/)).toBeInTheDocument();
    expect(screen.queryByText(/Original Plan:/)).not.toBeInTheDocument();
    expect(racePlan.weeklyPlan?.[0].distanceKm).toBe(8);
  });
});

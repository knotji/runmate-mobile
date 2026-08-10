import { render, screen, within } from '@testing-library/react';
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
  it('keeps the visible brief compact and moves explanations behind disclosure', () => {
    render(<TodayTrainingPlanCard context={moderateContext()} />);

    const card = screen.getByLabelText("Today's Brief");
    const focus = card.querySelector('.today-brief-focus');
    expect(focus).not.toBeNull();
    expect(within(focus as HTMLElement).getByText('One Adjustment')).toBeInTheDocument();
    expect(within(focus as HTMLElement).getByText(/Main Signal/)).toBeInTheDocument();
    expect(within(focus as HTMLElement).queryByText('Body Readiness')).not.toBeInTheDocument();
    expect(screen.getByText('Adaptive · Reduce')).toBeInTheDocument();
    expect(screen.getByText('Keep Today Controlled')).toBeInTheDocument();
    expect(screen.getByText('No Single Strong Limiter')).toBeInTheDocument();
    expect(screen.getAllByText('Reduce Today’s Load')).toHaveLength(1);
    expect(screen.getByText(/\d key signals?/)).toBeInTheDocument();
    expect(screen.getByText(/View \d+ more signals?/)).toBeInTheDocument();
    expect(screen.queryByText(/Original Plan:/)).not.toBeInTheDocument();
    expect(racePlan.weeklyPlan?.[0].distanceKm).toBe(8);
  });

  it("keeps an unchanged recommendation compact without adjustment copy", () => {
    const context = moderateContext();
    context.recoverySystem.overallScore = 80;

    render(<TodayTrainingPlanCard context={context} />);

    const focus = screen.getByLabelText("Today's Brief").querySelector('.today-brief-focus');
    expect(focus).not.toBeNull();
    expect(within(focus as HTMLElement).queryByText("Today's Plan")).not.toBeInTheDocument();
    expect(within(focus as HTMLElement).queryByText('One Adjustment')).not.toBeInTheDocument();
    expect(within(focus as HTMLElement).getByText('Keep The Original Plan')).toBeInTheDocument();
    expect(screen.queryByText('Adaptive · Keep')).not.toBeInTheDocument();
    expect(screen.getAllByText('Keep The Original Plan')).toHaveLength(1);
  });
});

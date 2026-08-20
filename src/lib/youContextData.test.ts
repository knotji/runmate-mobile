import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { DailyStrainCheckIn } from '@/lib/strainContext';
import type { WeekWorkout } from '@/types/race';
import { assembleYouContext } from './youContextData';

function coachContext(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    todayDate: '2026-08-20',
    activeRaceStatus: 'none',
    raceName: null,
    raceDistance: null,
    raceDate: null,
    activePain: false,
    latestPain: null,
    activeSick: false,
    latestBody: null,
    ...overrides,
  } as unknown as CoachContext;
}

function checkIn(overrides: Partial<DailyStrainCheckIn> = {}): DailyStrainCheckIn {
  return { date: '2026-08-20', stress: null, environment: null, updatedAt: '2026-08-20T00:00:00.000Z', ...overrides };
}

describe('assembleYouContext', () => {
  it('shows an honest "No Goal Set" focus card, with a real CTA, when there is no active race', () => {
    const result = assembleYouContext({ coachContext: coachContext(), plannedWorkout: null, checkIn: checkIn() });

    expect(result.focus).toEqual({ title: 'No Goal Set', detail: 'Set a race or running goal so WholeMate can shape guidance around it.', ctaLabel: 'Set A Goal', ctaPath: '/race-goal' });
  });

  it('surfaces the active race goal with distance and formatted date', () => {
    const result = assembleYouContext({
      coachContext: coachContext({ activeRaceStatus: 'scheduled', raceName: 'Bangkok Marathon', raceDistance: 'Full Marathon', raceDate: '2026-12-06' }),
      plannedWorkout: null,
      checkIn: checkIn(),
    });

    expect(result.focus.title).toBe('Bangkok Marathon');
    expect(result.focus.detail).toBe('Full Marathon · Dec 6, 2026');
    expect(result.focus.ctaLabel).toBe('View Goal');
  });

  it('describes today\'s planned workout, and marks it a rest day when the plan says so', () => {
    const plan = { workoutType: 'Tempo Run', distanceKm: 8, durationMin: 40 } as unknown as WeekWorkout;
    const result = assembleYouContext({ coachContext: coachContext(), plannedWorkout: plan, checkIn: checkIn() });

    const planItem = result.context.find((item) => item.label === 'Today’s Plan')!;
    expect(planItem.value).toBe('Tempo Run · 8 km · 40 min');
    expect(planItem.path).toBe('/weekly-plan');
  });

  it('shows "None Reported" for pain when nothing is active, and the real report when it is', () => {
    const clear = assembleYouContext({ coachContext: coachContext(), plannedWorkout: null, checkIn: checkIn() });
    expect(clear.context.find((item) => item.label === 'Pain Status')).toEqual({ label: 'Pain Status', value: 'None Reported', tone: 'default', path: '/pain-trends' });

    const active = assembleYouContext({
      coachContext: coachContext({ activePain: true, latestPain: { painLocation: 'Right knee', painLevel: 4 } as never }),
      plannedWorkout: null,
      checkIn: checkIn(),
    });
    expect(active.context.find((item) => item.label === 'Pain Status')).toEqual({ label: 'Pain Status', value: 'Right knee · 4/10', tone: 'caution', path: '/pain-trends' });
  });

  it('omits the Body Weight row entirely when no weight is on file, rather than showing a fabricated 0 kg', () => {
    const result = assembleYouContext({ coachContext: coachContext(), plannedWorkout: null, checkIn: checkIn() });
    expect(result.context.some((item) => item.label === 'Body Weight')).toBe(false);

    const withWeight = assembleYouContext({ coachContext: coachContext({ latestBody: { weightKg: 68.4, bodyFatPct: null, muscleKg: null } }), plannedWorkout: null, checkIn: checkIn() });
    expect(withWeight.context.find((item) => item.label === 'Body Weight')).toEqual({ label: 'Body Weight', value: '68.4 kg', tone: 'default', path: '/body-weight-trend' });
  });

  it('adds a Health Status row only when a sick check-in is active, with no linked destination', () => {
    const result = assembleYouContext({ coachContext: coachContext({ activeSick: true }), plannedWorkout: null, checkIn: checkIn() });
    const healthStatus = result.context.find((item) => item.label === 'Health Status')!;
    expect(healthStatus).toEqual({ label: 'Health Status', value: 'Sick Check-In Active', tone: 'caution' });
    expect(healthStatus.path).toBeUndefined();
  });

  it('reports an honest empty check-in when nothing was logged today', () => {
    const result = assembleYouContext({ coachContext: coachContext(), plannedWorkout: null, checkIn: checkIn() });
    expect(result.checkIn).toEqual({ hasCheckIn: false, stress: null, environment: null });
  });

  it('surfaces a logged check-in with human-readable labels', () => {
    const result = assembleYouContext({ coachContext: coachContext(), plannedWorkout: null, checkIn: checkIn({ stress: 'high', environment: 'hot_humid' }) });
    expect(result.checkIn).toEqual({ hasCheckIn: true, stress: 'High', environment: 'Hot & Humid' });
  });
});

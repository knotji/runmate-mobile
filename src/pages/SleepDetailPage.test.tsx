import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { CoachContext, WeekSleepRow } from '@/lib/buildCoachContext';

function night(date: string): WeekSleepRow {
  return {
    date,
    score: 80,
    durationMinutes: 420,
    timeInBedMinutes: 460,
    sleepStartTime: `${date}T22:30:00.000Z`,
    sleepEndTime: `${date}T06:00:00.000Z`,
    remMinutes: 90,
    lightMinutes: 200,
    deepMinutes: 100,
    awakeMinutes: 30,
    hrv: 45,
    restingHR: 52,
    restingHRSource: null,
    respiratoryRate: 14,
  } as unknown as WeekSleepRow;
}

const sleepHistory = [night('2026-08-20'), night('2026-08-19'), night('2026-08-18')];

const { sharedContext } = vi.hoisted(() => ({
  sharedContext: {
    todayDate: '2026-08-20',
    recoverySystem: { scoreState: 'scored', dataFreshness: { status: 'today', latestSleepDate: '2026-08-20', ageDays: 0 } },
    sleepHistory: [] as unknown[],
    sleepBaseline30d: [] as unknown[],
  },
}));
sharedContext.sleepHistory = sleepHistory;
sharedContext.sleepBaseline30d = sleepHistory;

vi.mock('@/lib/coachContextService', () => ({
  buildCoachContextFromSupabase: vi.fn().mockResolvedValue(null),
  buildRecoveryCoreContextFromSupabase: vi.fn().mockResolvedValue(sharedContext as unknown as CoachContext),
}));
vi.mock('@/lib/context/coachContextStore', () => ({
  useCoachContextStore: (selector: (state: { context: CoachContext | null }) => unknown) => selector({ context: sharedContext as unknown as CoachContext }),
}));
vi.mock('@/lib/recoveryStartupCache', () => ({
  loadRecoveryContextStartupEntry: () => ({ context: sharedContext as unknown as CoachContext, savedAt: '2026-08-20T00:00:00.000Z' }),
  saveRecoveryContextStartupSnapshot: vi.fn(),
}));
vi.mock('@/lib/sleepDetailLoad', () => ({ requiresFullSleepHistory: () => false }));
// IonDatetime (rendered inside the calendar modal this test opens) uses
// IntersectionObserver internally, which jsdom doesn't implement — stub it
// out since the calendar picker's own behavior isn't what this test covers.
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return { ...actual, IonDatetime: () => null };
});
vi.mock('@/components/health/SleepDetailSections', () => ({
  RecordReliability: () => null,
  SleepHeartRate: () => null,
  SleepScoreBreakdown: () => <div>Sleep Score Breakdown</div>,
  SleepStages: () => null,
}));

const calculateRunMateSleepScoreSpy = vi.fn((nights: unknown[]) => { void nights; return { score: 82 }; });
vi.mock('@/lib/runMateSleepScore', () => ({
  calculateRunMateSleepScore: (nights: unknown[]) => calculateRunMateSleepScoreSpy(nights),
}));

import SleepDetailPage from '@/pages/SleepDetailPage';

describe('SleepDetailPage', () => {
  it('does not recompute the sleep score breakdown when unrelated state changes, like opening the night picker', async () => {
    render(<MemoryRouter><SleepDetailPage /></MemoryRouter>);

    await screen.findByText('Sleep Score Breakdown');
    const callsAfterInitialRender = calculateRunMateSleepScoreSpy.mock.calls.length;
    expect(callsAfterInitialRender).toBeGreaterThan(0);

    // Opening the calendar only touches `calendarOpen` — the selected night
    // and the sleep history behind it are unchanged, so the sleep-score
    // recalculation (up to 31 nights of Intl.DateTimeFormat-based parsing)
    // must not run again.
    fireEvent.click(screen.getByRole('button', { name: /Choose sleep night/ }));
    await waitFor(() => expect(calculateRunMateSleepScoreSpy).toHaveBeenCalledTimes(callsAfterInitialRender));
  });
});

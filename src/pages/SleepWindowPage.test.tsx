import { act, fireEvent, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter, Route, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';

let resolveWakePlan: ((value: { minutes: number | null; synced: boolean }) => void) | null = null;

vi.mock('@/lib/coachContextService', () => ({
  buildCoachContextFromSupabase: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/sleepWindowStorage', () => ({
  loadTonightWakePlan: vi.fn(() => new Promise((resolve) => { resolveWakePlan = resolve; })),
  loadDefaultWakeTime: vi.fn().mockResolvedValue(null),
  saveTonightWakePlan: vi.fn().mockResolvedValue({ ok: true }),
  deleteTonightWakePlan: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/lib/sleepWindow', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sleepWindow')>('@/lib/sleepWindow');
  return { ...actual, loadTonightWakeOverride: () => null, loadTonightSleepCycleOverride: () => null, saveTonightSleepCycleOverride: vi.fn(), clearTonightSleepCycleOverride: vi.fn() };
});
vi.mock('@/lib/recoveryStartupCache', () => ({
  loadRecoveryContextStartupSnapshot: () => context(),
}));

function context(): CoachContext {
  return {
    recoverySystem: {
      sleepPerformance: {
        sleepNeedMinutes: 480,
        targetWakeTime: '7:00 AM',
      },
    },
  } as unknown as CoachContext;
}

let mockedSharedContext: CoachContext | null = null;
vi.mock('@/lib/context/coachContextStore', () => ({
  useCoachContextStore: (selector: (state: { context: CoachContext | null }) => unknown) => selector({ context: mockedSharedContext }),
}));

import SleepWindowPage from './SleepWindowPage';

describe('SleepWindowPage', () => {
  it('does not let a slow background load clobber a wake-time edit made while it was in flight', async () => {
    mockedSharedContext = context();
    resolveWakePlan = null;
    render(<IonApp><MemoryRouter><SleepWindowPage /></MemoryRouter></IonApp>);

    // Cached context paints instantly, so the wake-time input is already visible
    // before loadTonightWakePlan() (still in flight) resolves.
    const input = await screen.findByLabelText('Wake Time') as HTMLInputElement;
    expect(input.value).toBe('07:00');

    // The user edits the wake time before the background load resolves.
    fireEvent.change(input, { target: { value: '06:15' } });
    expect(input.value).toBe('06:15');

    // Now the slow background fetch resolves with the *old* stored wake time.
    await act(async () => {
      resolveWakePlan?.({ minutes: 420, synced: true }); // 420 = 7:00 AM
      await Promise.resolve();
      await Promise.resolve();
    });

    // The user's in-progress edit must survive — not be silently reverted to 07:00.
    expect(input.value).toBe('06:15');
  });

  it('honors returnTo so Back restores the specific historical night Sleep Details was showing, instead of always landing on the latest night', async () => {
    mockedSharedContext = context();
    resolveWakePlan = null;
    const returnTo = encodeURIComponent('/sleep?date=2026-08-10&from=activity');

    function LocationProbe() {
      const location = useLocation();
      return <span data-testid="location">{location.pathname}{location.search}</span>;
    }

    render(<IonApp><MemoryRouter initialEntries={[`/sleep-window?from=health&returnTo=${returnTo}`]}>
      <Route exact path="/sleep-window"><SleepWindowPage /></Route>
      <Route><LocationProbe /></Route>
    </MemoryRouter></IonApp>);

    fireEvent.click(await screen.findByLabelText('Go Back'));

    // Must land back on the exact night (and originating tab) Sleep Details was
    // showing — not the hardcoded '/sleep' (latest night) this used to fall back to.
    expect(await screen.findByTestId('location')).toHaveTextContent('/sleep?date=2026-08-10&from=activity');
  });
});

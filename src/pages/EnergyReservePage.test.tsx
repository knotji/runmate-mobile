import { act, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';

const buildRecoveryPageContextFromSupabase = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/coachContextService', () => ({
  buildRecoveryPageContextFromSupabase: (...args: unknown[]) => buildRecoveryPageContextFromSupabase(...args),
}));
vi.mock('@/lib/recoveryStartupCache', () => ({
  loadRecoveryContextStartupSnapshot: () => null,
}));
vi.mock('@/lib/strainContext', () => ({
  loadDailyStrainCheckIn: () => null,
}));

let mockedSharedContext: CoachContext | null = null;
vi.mock('@/lib/context/coachContextStore', () => ({
  useCoachContextStore: (selector: (state: { context: CoachContext | null }) => unknown) => selector({ context: mockedSharedContext }),
}));

import EnergyReservePage from './EnergyReservePage';

function recovery(overrides: Partial<RunMateRecoverySystem> = {}): RunMateRecoverySystem {
  return {
    model: 'whoop_style_v1',
    scoreState: 'unscorable',
    dataFreshness: { status: 'missing', latestSleepDate: null, ageDays: null },
    overallScore: 0,
    overallLabel: 'Low',
    overallDisplayStatus: { score: 0, label: 'Low', thaiLabel: '', displayLabel: 'Low', cautionLevel: 'none' },
    coachingState: 'recover',
    headline: '',
    recovery: { key: 'recovery', score: 0, status: 'low', label: '', summary: '', reasons: [] },
    strain: { score: 0, scaleMax: 21, level: 'light', label: '', summary: '', estimated: true, reasons: [], weeklyTrend: { sessions: 0, distanceKm: 0 } },
    sleepPerformance: { score: 0, state: 'unscorable', label: '', summary: '', estimated: true, sleepNeedMinutes: 480, actualSleepMinutes: null, sufficiencyScore: null, consistencyScore: null, qualityScore: null, efficiencyScore: null, sleepDebtMinutes: 0, targetWakeTime: null, targetSleepTime: null, recommendedInBedTime: null, reasons: [], missing: [] },
    fuelInsight: { status: 'unknown', label: '', summary: 'No meal data yet.', reasons: [] },
    axes: {
      recovery: { key: 'recovery', score: 0, status: 'low', label: '', summary: '', reasons: [] },
      load: { key: 'load', score: 0, status: 'low', label: '', summary: '', reasons: [] },
      sleep: { key: 'sleep', score: 0, status: 'low', label: '', summary: '', reasons: [] },
      fuel: { key: 'fuel', score: 0, status: 'low', label: '', summary: '', reasons: [] },
    },
    guardrails: [],
    recommendedIntensity: 'rest',
    sourceCoverage: { used: [], missing: [] },
    ...overrides,
  };
}

function context(recoverySystem: RunMateRecoverySystem): CoachContext {
  return {
    todayDate: '2026-08-21',
    recoverySystem,
    activePain: false,
    activeSick: false,
  } as unknown as CoachContext;
}

describe('EnergyReservePage', () => {
  it('does not render a fabricated "−0" breakdown when Recovery is not current yet', () => {
    mockedSharedContext = context(recovery());
    render(<IonApp><MemoryRouter><EnergyReservePage /></MemoryRouter></IonApp>);

    expect(screen.getByText('Waiting For Today')).toBeInTheDocument();
    expect(screen.queryByText('−0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Recorded Strain used/)).not.toBeInTheDocument();
    expect(screen.queryByText('How Today Changed')).not.toBeInTheDocument();
  });

  it('renders the real breakdown once Recovery is current', () => {
    mockedSharedContext = context(recovery({
      scoreState: 'scored',
      dataFreshness: { status: 'today', latestSleepDate: '2026-08-21', ageDays: 0 },
      overallScore: 76,
      strain: { score: 6, scaleMax: 21, level: 'moderate', label: '', summary: '', estimated: false, reasons: [], weeklyTrend: { sessions: 0, distanceKm: 0 } },
    }));
    render(<IonApp><MemoryRouter><EnergyReservePage /></MemoryRouter></IonApp>);

    expect(screen.getByText('How Today Changed')).toBeInTheDocument();
    expect(screen.getByLabelText(/Recorded Strain used/)).toBeInTheDocument();
  });

  it('shows a genuine zero drain as "0", never as a fabricated-looking "−0"', () => {
    mockedSharedContext = context(recovery({
      scoreState: 'scored',
      dataFreshness: { status: 'today', latestSleepDate: '2026-08-21', ageDays: 0 },
      overallScore: 82,
      strain: { score: 0, scaleMax: 21, level: 'light', label: '', summary: '', estimated: false, reasons: [], weeklyTrend: { sessions: 0, distanceKm: 0 } },
    }));
    const { container } = render(<IonApp><MemoryRouter><EnergyReservePage /></MemoryRouter></IonApp>);

    expect(screen.getByText('How Today Changed')).toBeInTheDocument();
    expect(screen.queryByText(/−0/)).not.toBeInTheDocument();
    expect(screen.queryByText(/-0/)).not.toBeInTheDocument();
    const values = Array.from(container.querySelectorAll('.energy-breakdown-item strong')).map((node) => node.textContent);
    expect(values).toEqual(['+82', '0', '0']);
  });

  it('surfaces a failed pull-to-refresh instead of silently keeping the stale view with zero feedback', async () => {
    mockedSharedContext = context(recovery({
      scoreState: 'scored',
      dataFreshness: { status: 'today', latestSleepDate: '2026-08-21', ageDays: 0 },
      overallScore: 76,
    }));
    buildRecoveryPageContextFromSupabase.mockRejectedValueOnce(new Error('Network unavailable'));

    const { container } = render(<IonApp><MemoryRouter><EnergyReservePage /></MemoryRouter></IonApp>);
    expect(screen.getByText('How Today Changed')).toBeInTheDocument();

    // Simulate a pull-to-refresh: dispatch the same 'ionRefresh' custom event
    // IonRefresher fires, carrying the `detail.complete()` callback the page's
    // onIonRefresh handler calls once its own load(true) settles.
    const refresher = container.querySelector('ion-refresher');
    await act(async () => {
      refresher?.dispatchEvent(new CustomEvent('ionRefresh', { detail: { complete: () => undefined } }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The stale, already-visible Energy Reserve view must not silently pretend
    // the refresh succeeded.
    expect(await screen.findByText(/Refresh unavailable/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('How Today Changed')).toBeInTheDocument();
  });
});

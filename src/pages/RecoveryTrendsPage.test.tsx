import { act, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { RecoveryTrendsStartupSnapshot } from '@/lib/recoveryTrendsStartupCache';
import type { RecoveryTrend } from '@/lib/recoveryTrends';

const loadHistoryItems = vi.fn();
vi.mock('@/lib/cloudHistory', () => ({ loadHistoryItems: (...args: unknown[]) => loadHistoryItems(...args) }));
vi.mock('@/lib/profileStorage', () => ({ loadProfileFromSupabase: vi.fn().mockResolvedValue({ ok: true, profile: null }) }));
vi.mock('@/lib/healthSyncService', () => ({ syncTodayHealth: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/performanceDiagnostics', () => ({ measurePerformanceDiagnostic: (_name: string, fn: () => unknown) => fn() }));
vi.mock('@/lib/recoveryTrendsStartupCache', () => ({
  loadRecoveryTrendsStartupSnapshot: () => cachedSnapshot,
  saveRecoveryTrendsStartupSnapshot: vi.fn(),
}));

let cachedSnapshot: RecoveryTrendsStartupSnapshot | null = null;

function emptyTrend(days: number): RecoveryTrend {
  return {
    points: Array.from({ length: days }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      recovery: null, sleep: null, strain: null, state: 'missing', hrv: null, restingHR: null, respiratoryRate: null,
    })),
    insight: { direction: 'unavailable', change: null, title: 'More Nights Needed', summary: '', factors: [] },
    calibration: { confidence: 'limited', label: 'Limited Data', summary: '', latestSleepDate: null, freshness: 'missing', baselineNights: 0, targetBaselineNights: 14, availableSignalCount: 0, totalSignalCount: 4, signals: [] },
  };
}

import RecoveryTrendsPage from './RecoveryTrendsPage';

describe('RecoveryTrendsPage', () => {
  it('does not silently swallow a failed background refresh when a cached trend is already on screen', async () => {
    cachedSnapshot = { sevenDay: emptyTrend(7), thirtyDay: emptyTrend(30) };
    loadHistoryItems.mockResolvedValue({ ok: false, error: 'Network unavailable' });

    render(<IonApp><MemoryRouter><RecoveryTrendsPage /></MemoryRouter></IonApp>);

    // The cached trend paints immediately; the background load()'s failure must
    // still surface somewhere on screen instead of disappearing because `trend`
    // was already non-null.
    expect(await screen.findByText(/Refresh unavailable/)).toBeInTheDocument();
    expect(screen.getByText('See What Is Changing')).toBeInTheDocument();
  });

  it('gives "Try Again" visible feedback while a retry is in flight, instead of going blank once the previous error clears', async () => {
    cachedSnapshot = null;
    let resolveLoad: ((value: { ok: false; error: string }) => void) | null = null;
    loadHistoryItems
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLoad = resolve; }))
      .mockImplementationOnce(() => new Promise(() => { /* never resolves during this test */ }));

    render(<IonApp><MemoryRouter><RecoveryTrendsPage /></MemoryRouter></IonApp>);
    await act(async () => { resolveLoad?.({ ok: false, error: 'Network unavailable' }); await Promise.resolve(); });

    const tryAgain = await screen.findByText('Try Again');
    act(() => { tryAgain.click(); });

    // The retry clears the previous error immediately, so without `refreshing`
    // covering this window the page would render neither the error state nor
    // any loading indicator — just a blank content area.
    expect(await screen.findByText('Building Your Recovery Trends')).toBeInTheDocument();
  });
});

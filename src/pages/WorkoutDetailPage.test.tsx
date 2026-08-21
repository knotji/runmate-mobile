import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { vi } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';

const { workoutItem } = vi.hoisted(() => ({
  workoutItem: {
    id: 'workout-1',
    type: 'workout',
    createdAt: '2026-08-20T08:00:00.000Z',
    data: { extracted: { workoutKind: 'outdoor_run', distanceKm: 5, duration: '30:00' } },
  } as LocalHistoryItem,
}));

vi.mock('@/lib/activityStartupCache', () => ({ loadActivityStartupSnapshot: () => [workoutItem] }));
vi.mock('@/lib/cloudHistory', () => ({
  loadHistoryItemById: vi.fn().mockResolvedValue({ ok: true, item: workoutItem }),
  loadHistoryItems: vi.fn().mockResolvedValue({ ok: true, items: [workoutItem] }),
}));
vi.mock('@/lib/workoutDedupe', () => ({ dedupeWorkoutItems: (items: LocalHistoryItem[]) => items }));
vi.mock('@/lib/profileStorage', () => ({ loadProfileFromSupabase: vi.fn().mockResolvedValue({ ok: true, profile: null }) }));
vi.mock('@/components/SocialShareModal', () => ({ SocialShareModal: () => null }));

const buildWorkoutDetailSpy = vi.fn(() => ({
  isStrength: false,
  isSwim: false,
  tone: 'cardio',
  title: 'Outdoor Run',
  date: 'August 20, 2026',
  intensity: '',
  metrics: [{ label: 'Distance', value: '5 km' }],
  exercises: [],
  insights: [],
  heartRateZones: null,
  summaryHr: { avgHr: null, maxHr: null, hasSamples: false },
  source: 'WholeMate',
  reliability: { status: 'Single Source', sources: 'WholeMate', userCorrectedCount: 0, lastImportedAt: null },
}));
vi.mock('@/lib/workoutDetail', () => ({ buildWorkoutDetail: (...args: unknown[]) => buildWorkoutDetailSpy(...args) }));

import WorkoutDetailPage from '@/pages/WorkoutDetailPage';

describe('WorkoutDetailPage', () => {
  it('does not recompute the workout detail (including HR zone analysis) when unrelated state changes, like opening Share', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/activity/workout/workout-1']}>
        <Route path="/activity/workout/:id"><WorkoutDetailPage /></Route>
      </MemoryRouter>,
    );

    await screen.findByText('Outdoor Run');
    const callsAfterInitialRender = buildWorkoutDetailSpy.mock.calls.length;
    expect(callsAfterInitialRender).toBeGreaterThan(0);

    // Opening Share only touches showShareModal — the workout record itself,
    // the profile, and the resting HR baseline are all unchanged, so the
    // (potentially expensive) detail build must not run again. The Share
    // button is the sole ion-button inside the toolbar's end-slot ion-buttons
    // (IonButton's aria-label isn't reflected onto the DOM node without full
    // Ionic hydration in this test environment, so it can't be queried by
    // accessible name here).
    const shareButton = container.querySelector('ion-buttons ion-button');
    expect(shareButton).not.toBeNull();
    fireEvent.click(shareButton!);
    await waitFor(() => expect(buildWorkoutDetailSpy).toHaveBeenCalledTimes(callsAfterInitialRender));
  });
});

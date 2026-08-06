import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHistory } from 'react-router-dom';
import App from './App';

const authenticatedSession = {
  access_token: 'test-token',
  refresh_token: 'test-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'test-user' },
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: authenticatedSession } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/components/NetworkStatusToast', () => ({ NetworkStatusToast: () => null }));
vi.mock('@/components/MainTabs', () => ({
  default: function ActivityFixture() {
    const history = useHistory();
    return <main>
      <h1>Activity Fixture</h1>
      <button type="button" onClick={() => history.push('/activity/workout/workout-1')}>Open Workout</button>
    </main>;
  },
}));
vi.mock('@/pages/WorkoutDetailPage', () => ({
  default: function WorkoutDetailFixture() {
    const history = useHistory();
    return <main>
      <h1>Workout Detail Fixture</h1>
      <button type="button" onClick={() => history.push('/tabs/activity')}>Back To Activity</button>
    </main>;
  },
}));
vi.mock('@/pages/SleepDetailPage', () => ({ default: () => <h1>Sleep Detail Fixture</h1> }));
vi.mock('@/pages/RaceGoalPage', () => ({ default: () => <h1>Race Goal Fixture</h1> }));
vi.mock('@/pages/AiCoachPage', () => ({ default: () => <h1>AI Coach Fixture</h1> }));
vi.mock('@/pages/StrainDetailPage', () => ({ default: () => <h1>Strain Detail Fixture</h1> }));

describe('authenticated route contracts', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/tabs/activity');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens Workout Detail from Activity and returns without losing the tab route', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Workout' }));
    expect(await screen.findByRole('heading', { name: 'Workout Detail Fixture' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/activity/workout/workout-1');

    fireEvent.click(screen.getByRole('button', { name: 'Back To Activity' }));
    expect(await screen.findByRole('heading', { name: 'Activity Fixture' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/tabs/activity');
  });

  it.each([
    ['/sleep?date=2026-07-29&from=activity', 'Sleep Detail Fixture'],
    ['/race-goal', 'Race Goal Fixture'],
    ['/ai-coach', 'AI Coach Fixture'],
    ['/strain', 'Strain Detail Fixture'],
  ])('keeps authenticated critical route %s reachable', async (path, heading) => {
    window.history.replaceState({}, '', path);
    render(<App />);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe(path.split('?')[0]));
  });
});

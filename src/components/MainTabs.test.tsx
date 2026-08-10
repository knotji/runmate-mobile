import { render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MainTabs from './MainTabs';

vi.mock('@/pages/RecoveryPage', () => ({ default: () => <h1>Today Fixture</h1> }));
vi.mock('@/pages/HealthPage', () => ({ default: () => <h1>Health Fixture</h1> }));
vi.mock('@/pages/ActivityPage', () => ({ default: () => <h1>Move Fixture</h1> }));
vi.mock('@/pages/AiCoachPage', () => ({ default: () => <h1>Coach Fixture</h1> }));
vi.mock('@/pages/UploadPage', () => ({ default: () => <h1>Log Fixture</h1> }));
vi.mock('@/pages/MorePage', () => ({ default: () => <h1>Settings Fixture</h1> }));
vi.mock('@/lib/haptics', () => ({ hapticSelection: vi.fn() }));

describe('primary information architecture', () => {
  it('shows exactly the four product pillars in the tab bar', async () => {
    render(<IonApp><MemoryRouter initialEntries={['/tabs/today']}><MainTabs /></MemoryRouter></IonApp>);

    expect(await screen.findByRole('heading', { name: 'Today Fixture' })).toBeInTheDocument();
    const tabBar = screen.getByRole('tablist');
    expect(tabBar.querySelectorAll('ion-tab-button')).toHaveLength(4);
    expect(screen.getAllByText(/^(Today|Health|Move|Coach)$/).map((node) => node.textContent)).toEqual(['Today', 'Health', 'Move', 'Coach']);
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    expect(screen.queryByText('More')).not.toBeInTheDocument();
  });

  it.each([
    ['/tabs/recovery', 'Today Fixture'],
    ['/tabs/activity', 'Move Fixture'],
  ])('keeps legacy tab route %s working', async (route, heading) => {
    render(<IonApp><MemoryRouter initialEntries={[route]}><MainTabs /></MemoryRouter></IonApp>);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});

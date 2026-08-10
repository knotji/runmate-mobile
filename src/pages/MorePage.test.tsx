import React from 'react';
import { render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import MorePage from './MorePage';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('@/lib/morePageLoaders', () => ({ loadMorePage: vi.fn(() => Promise.resolve({})) }));

describe('Settings & Data information architecture', () => {
  it('contains only profile, data control, and support destinations', () => {
    render(<IonApp><MemoryRouter><MorePage /></MemoryRouter></IonApp>);

    expect(screen.getByText('Settings & Data')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your App, Your Data' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile & Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connections & Control' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'App & Diagnostics' })).toBeInTheDocument();
    expect(screen.getByText('Profile & Settings')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Health Connect')).toBeInTheDocument();
    expect(screen.getByText('Privacy, Export & Account')).toBeInTheDocument();
    expect(screen.getByText('About RunMate')).toBeInTheDocument();
    expect(screen.queryByText('Race Goal')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Training Summary')).not.toBeInTheDocument();
  });
});

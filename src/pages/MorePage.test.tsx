import React from 'react';
import { render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import MorePage from './MorePage';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('@/lib/morePageLoaders', () => ({ loadMorePage: vi.fn(() => Promise.resolve({})) }));

describe('You information architecture', () => {
  it('contains contextual Coach, profile, data control, and support destinations, plus Sign Out', () => {
    render(<IonApp><MemoryRouter><MorePage /></MemoryRouter></IonApp>);

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What WholeMate Knows About You' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Personal Controls' })).toBeInTheDocument();
    expect(screen.getByText('Coach History')).toBeInTheDocument();
    expect(screen.getByText('Profile & Settings')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Health Connect')).toBeInTheDocument();
    expect(screen.getByText('Privacy, Export & Account')).toBeInTheDocument();
    expect(screen.getByText('About WholeMate')).toBeInTheDocument();
    expect(screen.getByText('WholeMate Next')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
    expect(screen.queryByText('Race Goal')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Training Summary')).not.toBeInTheDocument();
  });
});

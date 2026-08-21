import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import MorePage from './MorePage';

const signOut = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { signOut: (...args: unknown[]) => signOut(...args) } } }));
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
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
    expect(screen.queryByText('WholeMate Next')).not.toBeInTheDocument();
    expect(screen.queryByText('Race Goal')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Training Summary')).not.toBeInTheDocument();
  });
});

describe('Sign Out confirmation', () => {
  it('does not sign out immediately on tap — it opens a confirmation first', async () => {
    render(<IonApp><MemoryRouter><MorePage /></MemoryRouter></IonApp>);

    fireEvent.click(screen.getByText('Sign Out'));
    expect(signOut).not.toHaveBeenCalled();
    expect(await screen.findByText('Sign Out?')).toBeInTheDocument();
  });

  it('only signs out once the destructive confirmation button is tapped', async () => {
    render(<IonApp><MemoryRouter><MorePage /></MemoryRouter></IonApp>);

    fireEvent.click(screen.getByText('Sign Out'));
    await screen.findByText('Sign Out?');
    const buttons = await screen.findAllByText('Sign Out');
    // The second "Sign Out" is the alert's destructive confirm button.
    fireEvent.click(buttons[buttons.length - 1]);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

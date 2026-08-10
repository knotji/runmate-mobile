import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import UploadPage from '@/pages/UploadPage';

vi.mock('@/components/SleepUploadFlow', () => ({ default: () => <div>Sleep Upload Flow</div> }));
vi.mock('@/components/WorkoutUploadFlow', () => ({ default: () => <div>Workout Upload Flow</div> }));
vi.mock('@/components/MealUploadFlow', () => ({ default: () => <div>Meal Upload Flow</div> }));

describe('UploadPage', () => {
  it('presents manual logging without selecting a record type', async () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'What Would You Like To Log?' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Record Type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sleep' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Workout' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Meal' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Log Your Meal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Workout' }));
    expect(await screen.findByText('Workout Upload Flow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workout' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['/tabs/log?type=meal', '/tabs/upload?type=meal'])('opens a requested flow directly from %s', async (path) => {
    render(<MemoryRouter initialEntries={[path]}><UploadPage /></MemoryRouter>);

    expect(await screen.findByText('Meal Upload Flow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Meal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('What Would You Like To Log?')).not.toBeInTheDocument();
  });
});

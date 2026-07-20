import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import UploadPage from '@/pages/UploadPage';

vi.mock('@/components/SleepUploadFlow', () => ({ default: () => <div>Sleep Upload Flow</div> }));
vi.mock('@/components/WorkoutUploadFlow', () => ({ default: () => <div>Workout Upload Flow</div> }));

describe('UploadPage', () => {
  it('starts without selecting an upload type', () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Sleep' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Workout' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Meal' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Log Your Meal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Workout' }));
    expect(screen.getByText('Workout Upload Flow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workout' })).toHaveAttribute('aria-pressed', 'true');
  });
});

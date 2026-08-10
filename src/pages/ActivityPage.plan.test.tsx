import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { vi } from 'vitest';
import { PlannedTrainingCard } from './ActivityPage';

describe('PlannedTrainingCard', () => {
  it('keeps planned training distinct from recorded data', () => {
    const onOpen = vi.fn();
    render(<IonApp><PlannedTrainingCard workout={{ day: 'Wed', workoutType: 'Intervals', distanceKm: 6, durationMin: 45, targetPace: '5:00-5:30/km', targetHR: null, description: '5 x 800 m with easy recoveries.' }} onOpen={onOpen} /></IonApp>);

    expect(screen.getByText('Planned Training')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Intervals' })).toBeInTheDocument();
    expect(screen.getByText('6 km · 45 min · 5:00-5:30/km')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Weekly Plan' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('presents rest as a plan without fake distance metadata', () => {
    render(<IonApp><PlannedTrainingCard workout={{ day: 'Mon', workoutType: 'Rest', distanceKm: null, targetPace: null, targetHR: null, description: 'Full rest day.' }} onOpen={vi.fn()} /></IonApp>);

    expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument();
    expect(screen.queryByText(/0 km|N\/A/i)).not.toBeInTheDocument();
  });
});

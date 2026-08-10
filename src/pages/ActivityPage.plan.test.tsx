import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { vi } from 'vitest';
import { MoveToolsNav, PlannedTrainingCard } from './ActivityPage';

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

  it('replaces a recovery pace placeholder with useful recovery guidance', () => {
    render(<IonApp><PlannedTrainingCard workout={{ day: 'Tue', workoutType: 'Recovery', distanceKm: 0, durationMin: 30, targetPace: 'N/A', targetHR: null, description: 'Light mobility, foam rolling, and dynamic stretching.' }} onOpen={vi.fn()} /></IonApp>);

    expect(screen.getByText('30 min · Easy Recovery')).toBeInTheDocument();
    expect(screen.queryByText(/N\/A/i)).not.toBeInTheDocument();
  });
});

describe('MoveToolsNav', () => {
  it('keeps planning, race, and summary destinations in Move', () => {
    const onPlan = vi.fn(); const onRace = vi.fn(); const onSummary = vi.fn();
    render(<IonApp><MoveToolsNav onPlan={onPlan} onRace={onRace} onSummary={onSummary} /></IonApp>);

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Race' }));
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(onPlan).toHaveBeenCalledOnce();
    expect(onRace).toHaveBeenCalledOnce();
    expect(onSummary).toHaveBeenCalledOnce();
  });
});

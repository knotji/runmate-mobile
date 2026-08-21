import { fireEvent, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { describe, expect, it, vi } from 'vitest';
import { TodayActionCard, TodayContinuityCard, TodayHero, TodayRingsRow, TodayWhyCard } from './RecoveryDialsView';
import type { EnergyReserve } from '@/lib/energyReserve';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';

function recovery(overallScore = 72): RunMateRecoverySystem {
  return {
    scoreState: 'scored',
    overallScore,
    overallLabel: 'Adequate',
    overallDisplayStatus: { note: 'Your latest signals are ready for today.' },
    dataFreshness: { status: 'today' },
    sleepPerformance: { targetWakeTime: '07:00', sleepNeedMinutes: 480, score: 78, actualSleepMinutes: 460 },
    strain: { score: 8, level: 'moderate' },
  } as unknown as RunMateRecoverySystem;
}

const ringsHandlers = { onRecoveryClick: vi.fn(), onSleepClick: vi.fn(), onStrainClick: vi.fn(), onEnergyClick: vi.fn() };
const limiter = { eyebrow: 'Likely Limiter', title: 'No Single Strong Limiter', summary: 'Available signals are close to your recent pattern.' };
const readiness = { status: 'steady' as const, eyebrow: 'Body Readiness', title: 'Ready For A Normal Day', summary: 'Your current recovery signals support a normal day without adding extra load.' };
const action = { eyebrow: 'One Adjustment', title: 'Keep Today Steady', summary: 'Stay active at a comfortable effort and avoid adding unplanned training load.' };

describe('TodayHero', () => {
  it('renders the readiness headline, summary, and a status-specific tone class', () => {
    const { container } = render(<IonApp><TodayHero readiness={readiness} /></IonApp>);
    expect(screen.getByText('Ready For A Normal Day')).toBeInTheDocument();
    expect(screen.getByText(readiness.summary)).toBeInTheDocument();
    expect(container.querySelector('.today-hero-steady')).toBeInTheDocument();
  });

  it('renders no freshness pill at all when freshness is omitted', () => {
    render(<IonApp><TodayHero readiness={readiness} /></IonApp>);
    expect(screen.queryByText(/ago|stale|refreshing/i)).not.toBeInTheDocument();
  });
});

describe('TodayRingsRow', () => {
  it('renders all four rings (Recovery, Sleep, Strain, Energy)', () => {
    render(<IonApp><TodayRingsRow recovery={recovery()} energy={{ available: true, score: 64 } as unknown as EnergyReserve} {...ringsHandlers} /></IonApp>);
    expect(screen.getByRole('button', { name: /Open Recovery details/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Sleep details/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Strain details/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Energy details/ })).toBeInTheDocument();
  });

  it('shows the Energy ring as unavailable (—) rather than inventing a score when energy is null', () => {
    render(<IonApp><TodayRingsRow recovery={recovery()} energy={null} {...ringsHandlers} /></IonApp>);
    expect(screen.getByRole('button', { name: 'Open Energy details' })).toHaveTextContent('—');
  });

  it('shows Sleep as an actual duration, not the /100 score', () => {
    render(<IonApp><TodayRingsRow recovery={recovery()} energy={null} {...ringsHandlers} /></IonApp>);
    const sleepRing = screen.getByRole('button', { name: /Open Sleep details/ });
    expect(sleepRing).toHaveTextContent('7h 40m');
    expect(sleepRing).not.toHaveTextContent('78');
    expect(sleepRing).not.toHaveTextContent('/100');
  });

  it('shows Sleep as unavailable (—) rather than deriving a fake duration from the score when actual minutes are unknown', () => {
    const noDuration = recovery();
    (noDuration.sleepPerformance as unknown as { actualSleepMinutes: null }).actualSleepMinutes = null;
    render(<IonApp><TodayRingsRow recovery={noDuration} energy={null} {...ringsHandlers} /></IonApp>);
    const sleepRing = screen.getByRole('button', { name: /Open Sleep details/ });
    expect(sleepRing).not.toHaveTextContent('0h 00m');
    expect(sleepRing).not.toHaveTextContent('0h 0m');
  });
});

describe('TodayWhyCard', () => {
  it('always shows the main-reason limiter', () => {
    render(<IonApp><TodayWhyCard limiter={limiter} /></IonApp>);
    expect(screen.getByText('No Single Strong Limiter')).toBeInTheDocument();
  });

  it('renders factor lines when why is ready', () => {
    render(<IonApp><TodayWhyCard limiter={limiter} why={{ status: 'ready', factors: [
      { key: 'sleepPerformance', label: 'Sleep Performance', detail: 'Sleep helped — 7h 40m, above your need', tone: 'up' },
      { key: 'restingHR', label: 'Resting HR', detail: 'Resting HR was above baseline', tone: 'down' },
    ] }} /></IonApp>);
    expect(screen.getByText('Sleep helped — 7h 40m, above your need')).toBeInTheDocument();
    expect(screen.getByText('Resting HR was above baseline')).toBeInTheDocument();
  });

  it('renders no factor lines at all when why is unavailable - never a placeholder pretending to explain', () => {
    render(<IonApp><TodayWhyCard limiter={limiter} why={{ status: 'unavailable' }} /></IonApp>);
    expect(screen.queryByLabelText("What's shaping today's Recovery")).not.toBeInTheDocument();
  });

  it('renders no factor lines when why is entirely omitted', () => {
    render(<IonApp><TodayWhyCard limiter={limiter} /></IonApp>);
    expect(screen.queryByLabelText("What's shaping today's Recovery")).not.toBeInTheDocument();
  });

  it('toggles open on click', () => {
    const { container } = render(<IonApp><TodayWhyCard limiter={limiter} /></IonApp>);
    const button = screen.getByRole('button');
    expect(container.querySelector('.today-why-card.open')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(container.querySelector('.today-why-card.open')).toBeInTheDocument();
  });
});

describe('TodayActionCard', () => {
  it('renders the one useful move', () => {
    render(<IonApp><TodayActionCard action={action} /></IonApp>);
    expect(screen.getByText('Keep Today Steady')).toBeInTheDocument();
    expect(screen.getByText(action.summary)).toBeInTheDocument();
  });

  it('is content-only - Ask Coach is a separate floating FAB, not part of this card', () => {
    render(<IonApp><TodayActionCard action={action} /></IonApp>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('TodayContinuityCard', () => {
  it('renders the message for a ready continuity', () => {
    render(<IonApp><TodayContinuityCard continuity={{ status: 'ready', tone: 'down', message: 'Yesterday you covered 8.5 km, more than the planned 5 km.' }} /></IonApp>);
    expect(screen.getByText('Yesterday you covered 8.5 km, more than the planned 5 km.')).toBeInTheDocument();
  });

  it('renders the message for a data gap', () => {
    render(<IonApp><TodayContinuityCard continuity={{ status: 'gap', message: "Yesterday's planned session hasn't synced yet, so it isn't reflected below." }} /></IonApp>);
    expect(screen.getByText("Yesterday's planned session hasn't synced yet, so it isn't reflected below.")).toBeInTheDocument();
  });

  it('renders nothing at all for status "none" - never a forced "all connected!" placeholder', () => {
    const { container } = render(<IonApp><TodayContinuityCard continuity={{ status: 'none' }} /></IonApp>);
    expect(container.querySelector('.continuity-card')).not.toBeInTheDocument();
  });
});

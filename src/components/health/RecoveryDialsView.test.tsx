import { render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryPlan } from './RecoveryDialsView';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';

function recovery(overallScore = 72): RunMateRecoverySystem {
  return {
    scoreState: 'scored',
    overallScore,
    sleepPerformance: { targetWakeTime: '07:00', sleepNeedMinutes: 480 },
    strain: { score: 8, level: 'moderate' },
  } as unknown as RunMateRecoverySystem;
}

describe('RecoveryPlan goal-aware note', () => {
  it('adds no goal note when no goal profile is supplied', () => {
    render(<IonApp><RecoveryPlan recovery={recovery()} wakeOverrideMinutes={null} sleepCycleOverride={null} onOpen={vi.fn()} /></IonApp>);
    expect(screen.queryByText(/goal/i)).not.toBeInTheDocument();
  });

  it('adds a sleep-goal note when sleep_better is in the goal profile', () => {
    render(<IonApp><RecoveryPlan recovery={recovery()} wakeOverrideMinutes={null} sleepCycleOverride={null} goalProfile={{ primaryGoal: 'sleep_better', secondaryGoals: [], guardrailGoals: [] }} onOpen={vi.fn()} /></IonApp>);
    expect(screen.getByText('This also supports your sleep goal directly.')).toBeInTheDocument();
  });

  it('adds a body-composition note when a body-recomposition goal is present, without changing the recovery-driven headline', () => {
    render(<IonApp><RecoveryPlan recovery={recovery()} wakeOverrideMinutes={null} sleepCycleOverride={null} goalProfile={{ primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: [] }} onOpen={vi.fn()} /></IonApp>);
    expect(screen.getByText('Consistent sleep supports recovery and your body-composition goal too.')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
  });

  it('does not add a goal note for a goal profile with neither sleep nor body-recomposition goals', () => {
    render(<IonApp><RecoveryPlan recovery={recovery()} wakeOverrideMinutes={null} sleepCycleOverride={null} goalProfile={{ primaryGoal: 'running_consistency', secondaryGoals: ['injury_prevention'], guardrailGoals: [] }} onOpen={vi.fn()} /></IonApp>);
    expect(screen.queryByText(/goal/i)).not.toBeInTheDocument();
  });
});

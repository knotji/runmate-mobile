import { fireEvent, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { describe, expect, it, vi } from 'vitest';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import { RecoveryPlan } from './RecoveryDialsView';

function recovery(): RunMateRecoverySystem {
  return {
    scoreState: 'scored',
    overallScore: 79,
    strain: { score: 1, level: 'light' },
    sleepPerformance: {
      sleepNeedMinutes: 420,
      targetWakeTime: '06:00',
    },
  } as RunMateRecoverySystem;
}

describe('Recovery Plan', () => {
  it('presents one clean bedtime and omits zero-minute noise', () => {
    render(<IonApp><RecoveryPlan recovery={recovery()} wakeOverrideMinutes={360} sleepCycleOverride={5} onOpen={vi.fn()} /></IonApp>);

    expect(screen.getByRole('heading', { name: 'In Bed By 10:10 PM' })).toBeInTheDocument();
    expect(screen.getByText('Sleep Need')).toHaveTextContent('Sleep Need 7h');
    expect(screen.queryByText(/7h 0m/)).not.toBeInTheDocument();
  });

  it('opens Sleep Plan from the full card with a descriptive label', () => {
    const onOpen = vi.fn();
    render(<IonApp><RecoveryPlan recovery={recovery()} wakeOverrideMinutes={360} sleepCycleOverride={5} onOpen={onOpen} /></IonApp>);

    fireEvent.click(screen.getByRole('button', { name: /Open tonight's Sleep Plan.*In bed by 10:10 PM.*Wake at 6:00 AM/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

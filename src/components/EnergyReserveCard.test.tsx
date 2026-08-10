import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnergyReserveCard } from '@/components/EnergyReserveCard';
import type { EnergyReserve } from '@/lib/energyReserve';

function reserve(fuel: EnergyReserve['fuel']): EnergyReserve {
  return {
    model: 'runmate_energy_reserve_v1',
    available: true,
    score: 80,
    level: 'ready',
    label: 'Ready',
    summary: 'No energy used yet.',
    startingRecovery: 80,
    strainDrain: 0,
    contextDrain: 0,
    used: 0,
    fuel,
    action: { title: 'Follow Your Plan', detail: 'Stay with the plan.' },
    context: [],
  };
}

describe('EnergyReserveCard', () => {
  it('hides an unknown fuel status from the compact summary', () => {
    render(<EnergyReserveCard energy={reserve({ status: 'unknown', label: 'Fuel Not Logged', summary: 'No meal data.' })} onOpen={vi.fn()} />);

    expect(screen.getByText('Energy Remaining')).toBeInTheDocument();
    expect(screen.queryByText('Fuel Not Logged')).not.toBeInTheDocument();
  });

  it('shows actionable fuel status when nutrition data is available', () => {
    render(<EnergyReserveCard energy={reserve({ status: 'low', label: 'Fuel Low', summary: 'More fuel is needed.' })} onOpen={vi.fn()} />);

    expect(screen.getByText('Fuel Low')).toBeInTheDocument();
  });
});

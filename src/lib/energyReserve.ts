import type { CoachContext } from '@/lib/buildCoachContext';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import type { DailyStrainCheckIn } from '@/lib/strainContext';

export type EnergyReserveLevel = 'ready' | 'steady' | 'low' | 'recharge' | 'unavailable';

export type EnergyReserve = {
  model: 'runmate_energy_reserve_v1';
  available: boolean;
  score: number | null;
  level: EnergyReserveLevel;
  label: string;
  summary: string;
  startingRecovery: number | null;
  strainDrain: number;
  contextDrain: number;
  used: number;
  fuel: {
    status: RunMateRecoverySystem['fuelInsight']['status'];
    label: string;
    summary: string;
  };
  action: { title: string; detail: string };
  context: string[];
};

type EnergyReserveInput = {
  recovery: RunMateRecoverySystem;
  checkIn?: DailyStrainCheckIn | null;
  activePain?: boolean;
  activeSick?: boolean;
};

const clamp = (value: number, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));

/**
 * A transparent product heuristic, not a biological energy measurement.
 * Recovery supplies the morning starting point. Recorded Strain and only
 * user-confirmed lifestyle context reduce the reserve throughout the day.
 */
export function buildEnergyReserve(input: EnergyReserveInput): EnergyReserve {
  const { recovery, checkIn = null, activePain = false, activeSick = false } = input;
  const fuel = fuelDisplay(recovery);
  const currentRecovery = (recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating')
    && recovery.dataFreshness.status === 'today';

  if (!currentRecovery) {
    return {
      model: 'runmate_energy_reserve_v1',
      available: false,
      score: null,
      level: 'unavailable',
      label: 'Waiting For Today',
      summary: 'A current Recovery score is needed before Energy Reserve can be estimated.',
      startingRecovery: null,
      strainDrain: 0,
      contextDrain: 0,
      used: 0,
      fuel,
      action: { title: 'Refresh Recovery', detail: 'Sync today\'s health data to establish a current starting point.' },
      context: [],
    };
  }

  const startingRecovery = Math.round(clamp(recovery.overallScore));
  const strainRatio = clamp(recovery.strain.score, 0, 21) / 21;
  const strainDrain = Math.round(Math.pow(strainRatio, 1.5) * 70);
  const context: string[] = [];
  let contextDrain = 0;

  if (checkIn?.stress === 'moderate') { contextDrain += 4; context.push('Moderate stress check-in'); }
  if (checkIn?.stress === 'high') { contextDrain += 8; context.push('High stress check-in'); }
  if (checkIn?.environment === 'hot_humid') { contextDrain += 3; context.push('Hot or humid conditions'); }

  const used = strainDrain + contextDrain;
  const score = Math.round(clamp(startingRecovery - used));
  const level = energyLevel(score);
  const label = energyLabel(level);

  return {
    model: 'runmate_energy_reserve_v1',
    available: true,
    score,
    level,
    label,
    summary: `${used} points used from a ${startingRecovery}-point morning Recovery.`,
    startingRecovery,
    strainDrain,
    contextDrain,
    used,
    fuel,
    action: nextAction({ score, activePain, activeSick, fuelStatus: recovery.fuelInsight.status, checkIn }),
    context,
  };
}

export function buildEnergyReserveFromContext(context: CoachContext, checkIn?: DailyStrainCheckIn | null): EnergyReserve {
  return buildEnergyReserve({
    recovery: context.recoverySystem,
    checkIn,
    activePain: context.activePain,
    activeSick: context.activeSick,
  });
}

function energyLevel(score: number): Exclude<EnergyReserveLevel, 'unavailable'> {
  if (score >= 70) return 'ready';
  if (score >= 45) return 'steady';
  if (score >= 25) return 'low';
  return 'recharge';
}

function energyLabel(level: EnergyReserveLevel): string {
  if (level === 'ready') return 'Ready';
  if (level === 'steady') return 'Steady';
  if (level === 'low') return 'Low';
  if (level === 'recharge') return 'Recharge';
  return 'Unavailable';
}

function fuelDisplay(recovery: RunMateRecoverySystem): EnergyReserve['fuel'] {
  const status = recovery.fuelInsight.status;
  const label = status === 'ready' ? 'Fuel Ready' : status === 'top_up' ? 'Fuel Top-Up' : status === 'low' ? 'Fuel Low' : 'Fuel Not Logged';
  return { status, label, summary: recovery.fuelInsight.summary };
}

function nextAction(input: Pick<EnergyReserveInput, 'activePain' | 'activeSick' | 'checkIn'> & { score: number; fuelStatus: RunMateRecoverySystem['fuelInsight']['status'] }): EnergyReserve['action'] {
  if (input.activeSick || input.activePain) return { title: 'Protect Your Energy', detail: 'Symptoms and pain take priority over the score. Keep today recovery-focused.' };
  if (input.score < 25) return { title: 'Protect Your Energy', detail: 'Avoid adding training load and prioritize food, fluids, and rest.' };
  if (input.fuelStatus === 'low' || input.fuelStatus === 'top_up') return { title: 'Fuel Before Adding Load', detail: 'Close the practical fuel gap before another demanding session.' };
  if (input.checkIn?.stress === 'high' || input.checkIn?.stress === 'moderate') return { title: 'Keep The Rest Of Today Lighter', detail: 'Use your stress check-in as context and avoid unnecessary extra load.' };
  if (input.score >= 70) return { title: 'Follow Your Plan', detail: 'Your remaining reserve supports the plan if you still feel well.' };
  return { title: 'Keep Today Steady', detail: 'Stay with the planned load and skip unplanned intensity.' };
}

import type { CoachContext } from '@/lib/buildCoachContext';

export type SupportCard = {
  category: 'body' | 'fuel' | 'hydration' | 'data';
  eyebrow: string;
  title: string;
  summary: string;
};

export function buildSupportCards(context: CoachContext): SupportCard[] {
  const recovery = context.recoverySystem;
  const cards: SupportCard[] = [];
  const activeSick = context.latestSick && context.latestSick.healthStatus !== 'normal';

  if (context.activePain || activeSick) {
    cards.push({
      category: 'body',
      eyebrow: 'Body Alert',
      title: context.activePain ? 'Protect The Painful Area' : 'Recovery Comes First',
      summary: context.activePain
        ? 'Active pain should take priority over today\'s score. Reduce load and avoid movements that aggravate it.'
        : 'Your latest health check shows fatigue or illness. Keep activity light and prioritize recovery.',
    });
  }

  if (recovery.fuelInsight.status === 'low' || recovery.fuelInsight.status === 'top_up') {
    cards.push({
      category: 'fuel',
      eyebrow: 'Fuel Support',
      title: recovery.fuelInsight.status === 'low' ? 'Fuel Needed' : 'Top Up',
      summary: recovery.fuelInsight.status === 'low'
        ? 'Carbohydrate and protein intake are below target.'
        : 'Add a little more fuel before taking on more strain.',
    });
  }

  const highStrain = recovery.strain.score >= 14;
  cards.push({
    category: 'hydration',
    eyebrow: 'Hydration Support',
    title: highStrain ? 'Replace Fluids' : 'Stay Ahead Of Hydration',
    summary: highStrain
      ? 'Today\'s higher Strain increases fluid needs. Rehydrate steadily across the rest of the day.'
      : 'No hydration total is available. Keep fluids steady throughout the day and around training.',
  });

  const staleSleep = recovery.scoreState === 'stale';
  const missingRecovery = recovery.scoreState === 'unscorable' || recovery.scoreState === 'calibrating';
  const missingMeal = recovery.fuelInsight.status === 'unknown';
  cards.push({
    category: 'data',
    eyebrow: staleSleep || missingRecovery || missingMeal ? 'Data Alert' : 'Data Coverage',
    title: staleSleep ? 'Sleep Data Is Out Of Date' : missingRecovery ? 'Recovery Is Still Calibrating' : missingMeal ? 'Meal Data Is Missing' : 'Recovery Data Is Current',
    summary: staleSleep
      ? 'Log or sync your latest sleep before treating Recovery as today\'s score.'
      : recovery.scoreState === 'calibrating'
        ? 'More baseline sleep records are needed before Recovery can be fully scored. Baseline calibration matures over 14 nights.'
        : missingRecovery
          ? 'More trustworthy overnight data is needed before Recovery can be fully scored.'
          : missingMeal
            ? 'Log a meal to unlock today\'s nutrition guidance.'
            : 'Today\'s Recovery is based on your latest available sleep and activity records.',
  });

  return cards.slice(0, 3);
}

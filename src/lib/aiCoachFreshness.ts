import type { CoachContext } from './buildCoachContext';
import type { RecoveryDataStatus } from './recoveryDataFreshness';

export function guardCoachContextFreshness(context: CoachContext, status: RecoveryDataStatus): CoachContext {
  if (status !== 'stale' && status !== 'fallback') return context;
  return {
    ...context,
    recoverySystem: {
      ...context.recoverySystem,
      scoreState: 'stale',
      dataFreshness: {
        ...context.recoverySystem.dataFreshness,
        status: 'stale',
      },
      guardrails: [
        ...context.recoverySystem.guardrails,
        'Cached coaching context is out of date. Do not increase or reduce today’s training load until data refresh succeeds.',
      ],
    },
  };
}

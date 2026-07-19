import { supabase } from '@/lib/supabaseClient';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { RaceGoal, RacePlan } from '@/types/race';

export async function generateRacePlan(goal: RaceGoal, context: CoachContext): Promise<RacePlan> {
  const recovery = context.recoverySystem;
  const { data, error } = await supabase.functions.invoke('generate-race-plan', {
    body: {
      goal,
      context: {
        recoveryScore: recovery.overallScore,
        recoveryState: recovery.scoreState,
        totalRunKm: context.totalRunKm,
        longestRunKm: context.longestRun7dKm,
        activePain: context.activePain,
        activeSick: context.activeSick,
      },
    },
  });
  if (error) throw new Error(error.message.includes('non-2xx') ? 'Could Not Generate A Training Plan. Please Try Again.' : error.message);
  if (!data?.data) throw new Error(data?.error ?? 'Race Plan Generation Returned No Result');
  return data.data as RacePlan;
}

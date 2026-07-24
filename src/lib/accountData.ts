import { loadHistoryItems } from '@/lib/cloudHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';
import { loadRaceResults } from '@/lib/raceResults';
import { supabase } from '@/lib/supabaseClient';

export type AccountDataExport = {
  exportedAt: string;
  profile: unknown;
  historyItems: unknown;
  raceGoal: unknown;
  racePlan: unknown;
  raceResults: unknown;
};

export async function buildAccountDataExport(): Promise<{ ok: true; data: AccountDataExport } | { ok: false; error: string }> {
  const [history, profile, race, raceResults] = await Promise.all([
    loadHistoryItems(),
    loadProfileFromSupabase(),
    loadActiveRaceGoalAndPlan(),
    loadRaceResults(200),
  ]);
  if (!history.ok) return { ok: false, error: history.error };

  return {
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      profile: profile.ok ? profile.profile ?? null : null,
      historyItems: history.items,
      raceGoal: race.ok ? race.goal : null,
      racePlan: race.ok ? race.plan : null,
      raceResults: raceResults.ok ? raceResults.results : null,
    },
  };
}

export function accountDataExportFileName(now = new Date()): string {
  return `RunMate-Data-Export-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Permanently deletes every RunMate row this account owns and the Supabase
 * Auth user itself, via the delete-account Edge Function (the mobile client
 * never holds the service-role privileges this requires). Irreversible.
 */
export async function deleteMyAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'ไม่พบ session ผู้ใช้ กรุณา login ใหม่ก่อนลบบัญชี' };

  try {
    const { data, error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;
    const payload = record(data);
    if (payload.error) return { ok: false, error: String(payload.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'ลบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

import { ensureSupabaseProfileSession } from '@/lib/profileStorage';
import { clearTonightWakeOverride, formatTimeInput, loadTonightWakeOverride, parseTimeInput, saveTonightWakeOverride, tonightDateKey } from '@/lib/sleepWindow';

type SleepWindowPlanRow = { wake_time: string };

export async function loadTonightWakePlan(): Promise<{ minutes: number | null; synced: boolean }> {
  const local = loadTonightWakeOverride();
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return { minutes: local, synced: false };
  const { data, error } = await session.supabase
    .from('sleep_window_plans')
    .select('wake_time')
    .eq('user_id', session.userId)
    .eq('target_date', tonightDateKey())
    .maybeSingle();
  if (error || !data) return { minutes: local, synced: false };
  const minutes = parseTimeInput(String((data as SleepWindowPlanRow).wake_time).slice(0, 5));
  if (minutes != null) saveTonightWakeOverride(minutes);
  return { minutes: minutes ?? local, synced: minutes != null };
}

export async function saveTonightWakePlan(minutes: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return { ok: false, error: ('message' in session && session.message) || 'Please sign in again before saving.' };
  const { error } = await session.supabase.from('sleep_window_plans').upsert({
    user_id: session.userId,
    target_date: tonightDateKey(),
    wake_time: formatTimeInput(minutes),
    timezone: 'Asia/Bangkok',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,target_date' });
  if (error) return { ok: false, error: error.message };
  saveTonightWakeOverride(minutes);
  window.dispatchEvent(new Event('runmate:sleep-window-updated'));
  return { ok: true };
}

export async function deleteTonightWakePlan(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return { ok: false, error: ('message' in session && session.message) || 'Please sign in again.' };
  const { error } = await session.supabase
    .from('sleep_window_plans')
    .delete()
    .eq('user_id', session.userId)
    .eq('target_date', tonightDateKey());
  if (error) return { ok: false, error: error.message };
  clearTonightWakeOverride();
  window.dispatchEvent(new Event('runmate:sleep-window-updated'));
  return { ok: true };
}

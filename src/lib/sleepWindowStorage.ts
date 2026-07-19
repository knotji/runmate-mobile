import { ensureSupabaseProfileSession } from '@/lib/profileStorage';
import { clearTonightWakeOverride, formatTimeInput, loadTonightWakeOverride, parseTimeInput, saveTonightWakeOverride, tonightDateKey } from '@/lib/sleepWindow';

type SleepWindowPlanRow = { wake_time: string };
const DEFAULT_WAKE_DATE = '2000-01-01';

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

export async function loadDefaultWakeTime(): Promise<number | null> {
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return null;
  const { data, error } = await session.supabase
    .from('sleep_window_plans')
    .select('wake_time')
    .eq('user_id', session.userId)
    .eq('target_date', DEFAULT_WAKE_DATE)
    .maybeSingle();
  if (error || !data) return null;
  return parseTimeInput(String((data as SleepWindowPlanRow).wake_time).slice(0, 5));
}

export async function saveDefaultWakeTime(minutes: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return { ok: false, error: ('message' in session && session.message) || 'Please sign in again before saving.' };
  const query = session.supabase.from('sleep_window_plans');
  const { error } = minutes == null
    ? await query.delete().eq('user_id', session.userId).eq('target_date', DEFAULT_WAKE_DATE)
    : await query.upsert({
      user_id: session.userId,
      target_date: DEFAULT_WAKE_DATE,
      wake_time: formatTimeInput(minutes),
      timezone: 'Asia/Bangkok',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,target_date' });
  if (error) return { ok: false, error: error.message };
  window.dispatchEvent(new Event('runmate:sleep-window-updated'));
  return { ok: true };
}

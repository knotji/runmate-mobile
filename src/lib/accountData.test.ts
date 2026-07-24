import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDataExportFileName, buildAccountDataExport, deleteMyAccount } from '@/lib/accountData';

vi.mock('@/lib/cloudHistory', () => ({
  loadHistoryItems: vi.fn(async () => ({ ok: true, items: [{ id: 'sleep-1', type: 'sleep' }] })),
}));
vi.mock('@/lib/profileStorage', () => ({
  loadProfileFromSupabase: vi.fn(async () => ({ ok: true, profile: { maxHr: 190 } })),
}));
vi.mock('@/lib/raceStorage', () => ({
  loadActiveRaceGoalAndPlan: vi.fn(async () => ({ ok: true, goal: { raceName: 'Half Marathon' }, plan: null })),
}));
vi.mock('@/lib/raceResults', () => ({
  loadRaceResults: vi.fn(async () => ({ ok: true, results: [] })),
}));

const invoke = vi.fn();
const getSession = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: { getSession: (...args: unknown[]) => getSession(...args) },
  },
}));

describe('buildAccountDataExport', () => {
  it('assembles history, profile, and race data into one export payload', async () => {
    const result = await buildAccountDataExport();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.historyItems).toEqual([{ id: 'sleep-1', type: 'sleep' }]);
    expect(result.data.profile).toEqual({ maxHr: 190 });
    expect(result.data.raceGoal).toEqual({ raceName: 'Half Marathon' });
    expect(typeof result.data.exportedAt).toBe('string');
  });
});

describe('accountDataExportFileName', () => {
  it('names the export file by date', () => {
    expect(accountDataExportFileName(new Date('2026-07-24T09:00:00Z'))).toBe('RunMate-Data-Export-2026-07-24.json');
  });
});

describe('deleteMyAccount', () => {
  beforeEach(() => {
    invoke.mockReset();
    getSession.mockReset();
  });

  it('requires an active session before invoking deletion', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const result = await deleteMyAccount();

    expect(result.ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('reports the Edge Function error message when deletion fails', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    invoke.mockResolvedValue({ data: { error: 'Account Deletion Is Not Configured' }, error: null });

    const result = await deleteMyAccount();

    expect(result).toEqual({ ok: false, error: 'Account Deletion Is Not Configured' });
  });

  it('succeeds when the Edge Function confirms deletion', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    invoke.mockResolvedValue({ data: { data: { deleted: true } }, error: null });

    const result = await deleteMyAccount();

    expect(result).toEqual({ ok: true });
  });
});

const PRIMARY_TAB_STATE_KEY = 'runmate:primary-tab-state';

export type PrimaryTabKey = 'today' | 'health' | 'move';

type PrimaryTabState = {
  moveDate?: string;
  moveDateSavedOn?: string;
  coachDraft?: string;
  scrollTop?: Partial<Record<PrimaryTabKey, number>>;
};

export function loadMoveSelectedDate(today: string): string {
  const state = readState();
  const value = state.moveDate;
  return state.moveDateSavedOn === today && value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today ? value : today;
}

export function saveMoveSelectedDate(date: string, today: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return;
  writeState({ ...readState(), moveDate: date, moveDateSavedOn: today });
}

export function loadCoachDraft(): string {
  const value = readState().coachDraft;
  return typeof value === 'string' ? value.slice(0, 1000) : '';
}

export function saveCoachDraft(draft: string): void {
  writeState({ ...readState(), coachDraft: draft.slice(0, 1000) });
}

export function loadPrimaryTabScroll(key: PrimaryTabKey): number {
  const value = readState().scrollTop?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function savePrimaryTabScroll(key: PrimaryTabKey, scrollTop: number): void {
  const state = readState();
  writeState({
    ...state,
    scrollTop: { ...state.scrollTop, [key]: Math.max(0, Math.round(scrollTop)) },
  });
}

function readState(): PrimaryTabState {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(PRIMARY_TAB_STATE_KEY) ?? '{}') as unknown;
    return parsed && typeof parsed === 'object' ? parsed as PrimaryTabState : {};
  } catch {
    return {};
  }
}

function writeState(state: PrimaryTabState): void {
  try { window.sessionStorage.setItem(PRIMARY_TAB_STATE_KEY, JSON.stringify(state)); }
  catch { /* View continuity must never block core health screens. */ }
}

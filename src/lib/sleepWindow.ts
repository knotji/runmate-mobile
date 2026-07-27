const STORAGE_PREFIX = 'runmate:sleep-window-wake:';
export const SLEEP_CYCLE_OPTIONS = [4, 5, 6] as const;
export type SleepCycleCount = typeof SLEEP_CYCLE_OPTIONS[number];
const ESTIMATED_CYCLE_MINUTES = 90;
const SLEEP_ONSET_MINUTES = 20;

export function normalizeDayMinutes(value: number): number {
  return ((value % 1440) + 1440) % 1440;
}

export function parseClockMinutes(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + Number(match[2]);
}

export function parseTimeInput(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function formatTimeInput(minutes: number): string {
  const normalized = normalizeDayMinutes(minutes);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function formatClockMinutes(minutes: number): string {
  const normalized = normalizeDayMinutes(minutes);
  const hour24 = Math.floor(normalized / 60);
  return `${hour24 % 12 || 12}:${String(normalized % 60).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

export function bedtimeReminderMinutes(asleepMinutes: number, leadMinutes = 60): number {
  return normalizeDayMinutes(asleepMinutes - leadMinutes);
}

export function sleepWindowForWake(wakeMinutes: number, sleepNeedMinutes: number) {
  const asleepMinutes = normalizeDayMinutes(wakeMinutes - sleepNeedMinutes);
  const idealInBedMinutes = normalizeDayMinutes(asleepMinutes - 20);
  return {
    wakeMinutes,
    asleepMinutes,
    idealInBedMinutes,
    windowStartMinutes: normalizeDayMinutes(idealInBedMinutes - 10),
    windowEndMinutes: normalizeDayMinutes(idealInBedMinutes + 10),
    estimatedCyclesLow: Math.max(1, Math.floor(sleepNeedMinutes / 100)),
    estimatedCyclesHigh: Math.max(1, Math.ceil(sleepNeedMinutes / 80)),
  };
}

export function recommendedSleepCycleCount(sleepNeedMinutes: number): SleepCycleCount {
  const count = Math.ceil(sleepNeedMinutes / ESTIMATED_CYCLE_MINUTES);
  return Math.min(6, Math.max(4, count)) as SleepCycleCount;
}

export function sleepCyclePlanForWake(
  wakeMinutes: number,
  cycleCount: SleepCycleCount,
  sleepNeedMinutes: number,
) {
  const sleepMinutes = cycleCount * ESTIMATED_CYCLE_MINUTES;
  const differenceMinutes = sleepMinutes - sleepNeedMinutes;
  const asleepMinutes = normalizeDayMinutes(wakeMinutes - sleepMinutes);
  return {
    cycleCount,
    wakeMinutes,
    asleepMinutes,
    inBedMinutes: normalizeDayMinutes(asleepMinutes - SLEEP_ONSET_MINUTES),
    sleepMinutes,
    differenceMinutes,
    adequacy: differenceMinutes >= 0 ? 'meets' : differenceMinutes >= -30 ? 'close' : 'short',
  } as const;
}

export function tonightDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function loadTonightWakeOverride(): number | null {
  const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${tonightDateKey()}`);
  return stored == null ? null : parseTimeInput(stored);
}

export function saveTonightWakeOverride(minutes: number): void {
  window.localStorage.setItem(`${STORAGE_PREFIX}${tonightDateKey()}`, formatTimeInput(minutes));
}

export function clearTonightWakeOverride(): void {
  window.localStorage.removeItem(`${STORAGE_PREFIX}${tonightDateKey()}`);
}

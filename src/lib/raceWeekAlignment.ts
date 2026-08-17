import type { RaceGoal, WeekWorkout } from '@/types/race';

const DISTANCE_KM: Record<string, number> = { '5K': 5, '10K': 10, 'Half Marathon': 21.0975, 'Full Marathon': 42.195 };

type RaceWeekGoal = Pick<RaceGoal, 'raceName' | 'raceDate' | 'raceDistance' | 'targetTime'>;

/**
 * Applies deterministic race-week safety rails at the presentation boundary.
 * This immediately repairs legacy plans without rewriting completed days or
 * waiting for another AI refresh.
 */
export function alignRaceWeekPlan(
  goal: RaceWeekGoal,
  workouts: WeekWorkout[],
  windowStart: string,
  today: string,
  completedWorkoutDates: string[] = [],
): WeekWorkout[] {
  if (!validDate(goal.raceDate) || !validDate(windowStart)) return workouts;
  const windowEnd = shiftDate(windowStart, 6);
  if (goal.raceDate < windowStart || goal.raceDate > windowEnd) return workouts;

  const completed = new Set(completedWorkoutDates.map((date) => date.slice(0, 10)));
  const byDate = new Map<string, WeekWorkout>();
  for (const workout of workouts) {
    const date = workoutDateInWindow(workout, windowStart);
    if (date) byDate.set(date, workout);
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const date = shiftDate(windowStart, offset);
    const daysBeforeRace = dateDiff(date, goal.raceDate);
    // Race day is a fixed calendar fact tied to the active Race Goal, not a soft
    // taper adjustment — it must always win, even if the date is in the past or
    // something unrelated (or the race result itself) was already logged that day.
    // Otherwise the Weekly Plan can keep showing a stale pre-alignment entry (e.g.
    // "Easy Run") on the actual race date once anything is logged that day.
    if (daysBeforeRace === 0) { byDate.set(date, raceDayWorkout(goal)); continue; }
    const existing = byDate.get(date);
    if (date < today || completed.has(date)) continue;
    if (daysBeforeRace === 1) byDate.set(date, restWorkout(weekday(date), 'พักก่อนวันแข่ง เตรียมอุปกรณ์ให้พร้อม ดื่มน้ำตามปกติ และใช้วันนี้แบบสบายๆ'));
    else if (daysBeforeRace === 2 && existing && !isRest(existing)) byDate.set(date, shakeoutWorkout(existing, weekday(date)));
    else if ((daysBeforeRace === 3 || daysBeforeRace === 4) && existing && isHard(existing)) byDate.set(date, racePrimerWorkout(existing, weekday(date), goal));
    else if (daysBeforeRace < 0) byDate.set(date, recoveryWorkout(weekday(date)));
  }

  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, workout]) => workout);
}

export function raceDayWorkout(goal: RaceWeekGoal): WeekWorkout {
  const distanceKm = DISTANCE_KM[goal.raceDistance] ?? null;
  const targetPace = targetPaceForGoal(goal);
  return {
    day: weekday(goal.raceDate),
    workoutType: 'Race Day',
    distanceKm,
    durationMin: durationMinutes(goal.targetTime),
    targetPace,
    targetHR: 'Race effort',
    description: `${goal.raceName} · ${goal.raceDistance} วอร์มอัพเบาๆ แล้วแข่งด้วยความหนักที่ควบคุมได้ตามเป้าเพซ`,
    purpose: 'ทำ Race Goal ที่ตั้งไว้ให้สำเร็จ',
    adjustment: 'วันแข่งถูกล็อกไว้ตาม Race Goal ที่ active อยู่',
  };
}

export function goalFromContext(value: Record<string, unknown> | null, fallback: { raceName: string | null; raceDate: string | null; raceDistance: string | null; targetTime: string | null }): RaceWeekGoal | null {
  const raceDate = text(value?.raceDate ?? value?.race_date) ?? fallback.raceDate;
  const raceName = text(value?.raceName ?? value?.race_name) ?? fallback.raceName;
  const raceDistance = text(value?.raceDistance ?? value?.race_distance) ?? fallback.raceDistance;
  if (!raceDate || !raceName || !raceDistance) return null;
  return { raceDate, raceName, raceDistance: raceDistance as RaceGoal['raceDistance'], targetTime: text(value?.targetTime ?? value?.target_time) ?? fallback.targetTime ?? undefined };
}

function shakeoutWorkout(existing: WeekWorkout, day: string): WeekWorkout {
  return {
    ...existing,
    day,
    workoutType: 'Shakeout Run',
    distanceKm: Math.min(existing.distanceKm ?? 3, 3),
    durationMin: Math.min(existing.durationMin ?? 25, 25),
    targetPace: 'Easy conversational pace',
    targetHR: 'Zone 1–2',
    description: 'วิ่งเบาๆ สั้นๆ คลายกล้ามเนื้อ ให้จบแบบรู้สึกสดชื่นกว่าตอนเริ่ม ไม่ต้องออกแรงหนัก',
    purpose: 'คงความคล่องตัวไว้โดยไม่เพิ่มความเหนื่อยล้าก่อนแข่ง 2 วัน',
    adjustment: 'จำกัดปริมาณซ้อมสำหรับสัปดาห์แข่ง',
  };
}

function racePrimerWorkout(existing: WeekWorkout, day: string, goal: RaceWeekGoal): WeekWorkout {
  return {
    ...existing,
    day,
    workoutType: 'Race Primer',
    distanceKm: Math.min(existing.distanceKm ?? 4, 4),
    durationMin: Math.min(existing.durationMin ?? 30, 30),
    targetPace: targetPaceForGoal(goal),
    targetHR: 'Controlled race effort',
    description: 'วอร์มอัพเบาๆ ตามด้วยความหนักระดับแข่ง 3 x 1 นาที สลับพักเต็มที่ แล้วคูลดาวน์',
    purpose: 'คงความคุ้นเคยกับจังหวะแข่งไว้โดยไม่สร้างความเหนื่อยล้าเพิ่ม',
    adjustment: 'ลดปริมาณการซ้อมหนักสำหรับสัปดาห์แข่ง',
  };
}

function restWorkout(day: string, description: string): WeekWorkout {
  return { day, workoutType: 'Rest', distanceKm: null, durationMin: null, targetPace: null, targetHR: null, description, purpose: 'เตรียมร่างกายให้สดชื่นพร้อมสำหรับวันแข่ง', adjustment: 'ใช้กฎความปลอดภัยของสัปดาห์แข่ง' };
}

function recoveryWorkout(day: string): WeekWorkout {
  return { day, workoutType: 'Recovery', distanceKm: null, durationMin: 20, targetPace: null, targetHR: 'Easy breathing', description: 'เดินเบาๆ หรือขยับตัวเบาๆ หลังแข่ง ไม่ต้องเร่งโหลดซ้อมเพิ่ม', purpose: 'เริ่มต้นการฟื้นตัวหลังแข่ง', adjustment: 'ใช้แผนฟื้นตัวหลังแข่ง' };
}

function targetPaceForGoal(goal: RaceWeekGoal): string | null {
  const distance = DISTANCE_KM[goal.raceDistance];
  const seconds = durationSeconds(goal.targetTime);
  if (!distance || !seconds) return null;
  const paceSeconds = Math.round(seconds / distance / 30) * 30;
  return `${Math.floor(paceSeconds / 60)}:${String(paceSeconds % 60).padStart(2, '0')}/km`;
}

function durationMinutes(value: string | undefined): number | null { const seconds = durationSeconds(value); return seconds == null ? null : Math.round(seconds / 60); }
function durationSeconds(value: string | undefined): number | null { if (!value) return null; const parts = value.split(':').map(Number); if (parts.some((part) => !Number.isFinite(part))) return null; const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : 0; return seconds > 0 ? seconds : null; }
function isRest(workout: WeekWorkout): boolean { return /rest|recovery/i.test(workout.workoutType); }
function isHard(workout: WeekWorkout): boolean { return /interval|tempo|threshold|speed|hill|race|hard/i.test(`${workout.workoutType} ${workout.description}`); }
function workoutDateInWindow(workout: WeekWorkout, windowStart: string): string | null { const dated = workout as WeekWorkout & { date?: string; dateKey?: string; dayDate?: string }; const explicit = dated.date ?? dated.dateKey ?? dated.dayDate; if (explicit && validDate(explicit.slice(0, 10))) return explicit.slice(0, 10); const wanted = weekdayIndex(workout.day); if (wanted < 0) return null; for (let offset = 0; offset < 7; offset += 1) { const date = shiftDate(windowStart, offset); if (weekdayIndex(date) === wanted) return date; } return null; }
function weekday(value: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T12:00:00+07:00`)); }
function weekdayIndex(value: string): number { if (validDate(value)) return new Date(`${value}T12:00:00+07:00`).getDay(); const day = value.trim().toLowerCase(); if (day.startsWith('sun')) return 0; if (day.startsWith('mon')) return 1; if (day.startsWith('tue')) return 2; if (day.startsWith('wed')) return 3; if (day.startsWith('thu')) return 4; if (day.startsWith('fri')) return 5; if (day.startsWith('sat')) return 6; return -1; }
function shiftDate(date: string, days: number): string { const parsed = new Date(`${date}T12:00:00+07:00`); parsed.setUTCDate(parsed.getUTCDate() + days); return parsed.toISOString().slice(0, 10); }
function dateDiff(from: string, to: string): number { return Math.round((Date.parse(`${to}T12:00:00+07:00`) - Date.parse(`${from}T12:00:00+07:00`)) / 86_400_000); }
function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00+07:00`)); }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }

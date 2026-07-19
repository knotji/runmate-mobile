import { Capacitor, type PermissionState } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { buildCoachContextFromSupabase, type CoachContext } from '@/lib/buildCoachContext';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import { loadDefaultWakeTime, loadTonightWakePlan } from '@/lib/sleepWindowStorage';
import { parseClockMinutes, sleepWindowForWake } from '@/lib/sleepWindow';
import { isMeaningfulRecoveryChange, isRestWorkout, loadNotificationPreferences, preferredTrainingMinutes } from '@/lib/notificationPreferences';

const IDS = { bedtime: 41001, workout: 41002, missingSleep: 41003, recovery: 41004 };
const TEST_ID = 41999;
const CHANNEL = 'runmate-guidance';
const RECOVERY_KEY = 'runmate:notification-recovery-snapshot:v1';
const SENT_PREFIX = 'runmate:notification-sent:';

export async function getNotificationPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return 'prompt';
  return (await LocalNotifications.checkPermissions()).display;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return 'prompt';
  return (await LocalNotifications.requestPermissions()).display;
}

export async function refreshNotifications(context?: CoachContext): Promise<{ permission: PermissionState; scheduled: string[] }> {
  const permission = await getNotificationPermission();
  if (!Capacitor.isNativePlatform() || permission !== 'granted') return { permission, scheduled: [] };
  await LocalNotifications.createChannel({ id: CHANNEL, name: 'RunMate Guidance', description: 'Sleep, Workout, and Recovery guidance', importance: 3, visibility: 1 });
  const ctx = context ?? await buildCoachContextFromSupabase();
  const prefs = loadNotificationPreferences();
  const idsToCancel = [IDS.bedtime, IDS.workout, IDS.missingSleep];
  if (!prefs.recoveryChange) idsToCancel.push(IDS.recovery);
  await LocalNotifications.cancel({ notifications: idsToCancel.map((id) => ({ id })) });
  const scheduled: string[] = [];
  if (prefs.bedtime && await scheduleBedtime(ctx)) scheduled.push('Bedtime');
  if (prefs.plannedWorkout && await scheduleWorkout(ctx)) scheduled.push('Workout');
  if (prefs.missingSleep && await scheduleMissingSleep(ctx)) scheduled.push('Missing Sleep');
  if (prefs.recoveryChange && await notifyRecoveryChange(ctx)) scheduled.push('Recovery');
  return { permission, scheduled };
}

export async function sendTestNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || await getNotificationPermission() !== 'granted') return false;
  await LocalNotifications.createChannel({ id: CHANNEL, name: 'RunMate Guidance', description: 'Sleep, Workout, and Recovery guidance', importance: 3, visibility: 1 });
  await schedule(TEST_ID, 'RunMate Notifications Are Ready', 'This is a test. Your personal reminders will use the preferences you selected.', new Date(Date.now() + 1200), '/notifications');
  return true;
}

async function scheduleBedtime(ctx: CoachContext): Promise<boolean> {
  const sleep = ctx.recoverySystem?.sleepPerformance;
  if (!sleep) return false;
  const [tonight, profileWake] = await Promise.all([loadTonightWakePlan(), loadDefaultWakeTime()]);
  const derivedWake = parseClockMinutes(sleep.targetWakeTime);
  const wake = tonight.minutes ?? profileWake ?? derivedWake;
  if (wake == null) return false;
  const window = sleepWindowForWake(wake, sleep.sleepNeedMinutes);
  const at = nextLocalClock(window.windowStartMinutes);
  await schedule(IDS.bedtime, 'Your Sleep Window Is Starting', `Aim to be asleep by ${clockLabel(window.asleepMinutes)} for ${durationLabel(sleep.sleepNeedMinutes)} of sleep.`, at, '/sleep-window');
  return true;
}

async function scheduleWorkout(ctx: CoachContext): Promise<boolean> {
  const workout = getTodayPlannedWorkout(ctx);
  if (!workout || isRestWorkout(workout.workoutType) || getTodayTrainingPlanStatus(ctx, workout) !== 'pending') return false;
  const at = todayLocalClock(preferredTrainingMinutes(String(ctx.profile?.preferredRunTime ?? 'flexible')));
  if (at.getTime() <= Date.now() + 60_000) return false;
  await schedule(IDS.workout, `Today's Plan: ${workout.workoutType}`, workout.durationMin ? `${workout.durationMin} min planned. Open RunMate for today's guidance.` : 'Open RunMate for today’s training guidance.', at, '/tabs/recovery');
  return true;
}

async function scheduleMissingSleep(ctx: CoachContext): Promise<boolean> {
  const now = new Date();
  const missingToday = ctx.recoverySystem?.dataFreshness.status !== 'today';
  if (now.getHours() >= 8 && missingToday && !wasSent('missing-sleep', ctx.todayDate)) {
    markSent('missing-sleep', ctx.todayDate);
    await schedule(IDS.missingSleep, 'Sleep Data Is Missing', 'Open RunMate to sync last night’s Sleep before using today’s Recovery.', new Date(Date.now() + 1500), '/tabs/recovery');
    return true;
  }
  const at = new Date(now);
  at.setHours(8, 0, 0, 0);
  if (at.getTime() <= now.getTime() || !missingToday) at.setDate(at.getDate() + 1);
  await schedule(IDS.missingSleep, 'Check Last Night’s Sleep', 'Open RunMate to sync Sleep before using today’s Recovery guidance.', at, '/tabs/recovery');
  return true;
}

async function notifyRecoveryChange(ctx: CoachContext): Promise<boolean> {
  const recovery = ctx.recoverySystem;
  if (!recovery || recovery.dataFreshness.status !== 'today' || recovery.scoreState === 'unscorable') return false;
  const current = Math.round(recovery.overallScore);
  const previous = readRecoverySnapshot();
  if (!previous || previous.date !== ctx.todayDate) {
    writeRecoverySnapshot(ctx.todayDate, current);
    return false;
  }
  if (!isMeaningfulRecoveryChange(previous.score, current) || wasSent('recovery', ctx.todayDate)) return false;
  markSent('recovery', ctx.todayDate);
  writeRecoverySnapshot(ctx.todayDate, current);
  const direction = current > previous.score ? 'improved' : 'dropped';
  await schedule(IDS.recovery, `Recovery ${direction === 'improved' ? 'Improved' : 'Changed'}`, `Your Recovery ${direction} to ${current}/100. Review today’s training guidance.`, new Date(Date.now() + 2000), '/tabs/recovery');
  return true;
}

async function schedule(id: number, title: string, body: string, at: Date, route: string) {
  await LocalNotifications.schedule({ notifications: [{ id, title, body, schedule: { at, allowWhileIdle: true }, channelId: CHANNEL, extra: { route } }] });
}
function todayLocalClock(minutes: number) { const d = new Date(); d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return d; }
function nextLocalClock(minutes: number) { const d = todayLocalClock(minutes); if (d.getTime() <= Date.now() + 60_000) d.setDate(d.getDate() + 1); return d; }
function clockLabel(minutes: number) { const h = Math.floor(minutes / 60); return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }
function durationLabel(minutes: number) { return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
function wasSent(kind: string, date: string) { return localStorage.getItem(`${SENT_PREFIX}${kind}`) === date; }
function markSent(kind: string, date: string) { localStorage.setItem(`${SENT_PREFIX}${kind}`, date); }
function readRecoverySnapshot(): { date: string; score: number } | null { try { return JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? 'null'); } catch { return null; } }
function writeRecoverySnapshot(date: string, score: number) { localStorage.setItem(RECOVERY_KEY, JSON.stringify({ date, score })); }

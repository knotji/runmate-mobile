import { Capacitor, type PermissionState } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { buildCoachContextFromSupabase, type CoachContext } from '@/lib/buildCoachContext';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import { loadDefaultWakeTime, loadTonightWakePlan } from '@/lib/sleepWindowStorage';
import { bedtimeReminderMinutes, parseClockMinutes, sleepWindowForWake } from '@/lib/sleepWindow';
import { isMeaningfulRecoveryChange, isRestWorkout, loadNotificationPreferences, preferredTrainingMinutes } from '@/lib/notificationPreferences';

const IDS = { bedtime: 41001, workout: 41002, missingSleep: 41003, recovery: 41004 };
const TEST_ID = 41999;
const CHANNEL = 'runmate-guidance';
const RECOVERY_KEY = 'runmate:notification-recovery-snapshot:v1';
const SENT_PREFIX = 'runmate:notification-sent:';

export type NotificationDiagnostic = {
  key: 'bedtime' | 'missingSleep' | 'plannedWorkout' | 'recoveryChange';
  label: string;
  state: 'scheduled' | 'monitoring' | 'off' | 'attention';
  detail: string;
  scheduledAt?: string;
};

export type NotificationDiagnostics = {
  permission: PermissionState;
  exactAlarm: PermissionState;
  pendingCount: number;
  checkedAt: string;
  rows: NotificationDiagnostic[];
};

type NotificationRefreshResult = { permission: PermissionState; scheduled: string[] };
const NOTIFICATION_REFRESH_COOLDOWN_MS = 60_000;
let activeNotificationRefresh: Promise<NotificationRefreshResult> | null = null;
let lastNotificationRefresh: { result: NotificationRefreshResult; completedAt: number } | null = null;

export async function getNotificationPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return 'prompt';
  return (await LocalNotifications.checkPermissions()).display;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return 'prompt';
  return (await LocalNotifications.requestPermissions()).display;
}

export async function getExactReminderPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return 'prompt';
  return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
}

export async function requestExactReminderPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return 'prompt';
  await LocalNotifications.changeExactNotificationSetting();
  return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
}

export function refreshNotifications(context?: CoachContext, force = false): Promise<NotificationRefreshResult> {
  if (activeNotificationRefresh) {
    return force
      ? activeNotificationRefresh.then(() => refreshNotifications(context, true))
      : activeNotificationRefresh;
  }
  if (!force && lastNotificationRefresh && Date.now() - lastNotificationRefresh.completedAt < NOTIFICATION_REFRESH_COOLDOWN_MS) {
    return Promise.resolve(lastNotificationRefresh.result);
  }

  activeNotificationRefresh = performNotificationRefresh(context)
    .then((result) => {
      lastNotificationRefresh = { result, completedAt: Date.now() };
      return result;
    })
    .finally(() => { activeNotificationRefresh = null; });
  return activeNotificationRefresh;
}

async function performNotificationRefresh(context?: CoachContext): Promise<NotificationRefreshResult> {
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

export async function getNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  const [permission, exactAlarm] = await Promise.all([getNotificationPermission(), getExactReminderPermission()]);
  const prefs = loadNotificationPreferences();
  const pending = Capacitor.isNativePlatform() && permission === 'granted'
    ? (await LocalNotifications.getPending()).notifications
    : [];
  const pendingById = new Map(pending.map((notification) => [notification.id, notification]));
  const definitions: Array<{ key: NotificationDiagnostic['key']; label: string; id: number }> = [
    { key: 'bedtime', label: 'Bedtime Reminder', id: IDS.bedtime },
    { key: 'missingSleep', label: 'Missing Sleep Alert', id: IDS.missingSleep },
    { key: 'plannedWorkout', label: 'Planned Workout', id: IDS.workout },
    { key: 'recoveryChange', label: 'Recovery Change', id: IDS.recovery },
  ];
  const rows = definitions.map(({ key, label, id }): NotificationDiagnostic => {
    if (!prefs[key]) return { key, label, state: 'off', detail: 'Turned off in your notification preferences.' };
    if (permission !== 'granted') return { key, label, state: 'attention', detail: 'Notification permission is required.' };
    if (key === 'bedtime' && exactAlarm !== 'granted') return { key, label, state: 'attention', detail: 'Allow Exact Reminders in Android settings so bedtime guidance can arrive on time.' };
    const notification = pendingById.get(id);
    if (notification) return {
      key,
      label,
      state: 'scheduled',
      detail: notification.title,
      scheduledAt: notification.schedule?.at ? new Date(notification.schedule.at).toISOString() : undefined,
    };
    if (key === 'recoveryChange') return { key, label, state: 'monitoring', detail: 'Waiting for fresh Recovery to change by 15 or more points.' };
    if (key === 'plannedWorkout') return { key, label, state: 'monitoring', detail: 'No pending session needs a reminder right now.' };
    return { key, label, state: 'attention', detail: 'No reminder is scheduled. Refresh the schedule to check again.' };
  });
  return { permission, exactAlarm, pendingCount: pending.filter((notification) => Object.values(IDS).includes(notification.id)).length, checkedAt: new Date().toISOString(), rows };
}

async function scheduleBedtime(ctx: CoachContext): Promise<boolean> {
  const sleep = ctx.recoverySystem?.sleepPerformance;
  if (!sleep) return false;
  const [tonight, profileWake] = await Promise.all([loadTonightWakePlan(), loadDefaultWakeTime()]);
  const derivedWake = parseClockMinutes(sleep.targetWakeTime);
  const wake = tonight.minutes ?? profileWake ?? derivedWake;
  if (wake == null) return false;
  const window = sleepWindowForWake(wake, sleep.sleepNeedMinutes);
  const reminderMinutes = bedtimeReminderMinutes(window.idealInBedMinutes);
  const at = nextLocalClock(reminderMinutes);
  await schedule(IDS.bedtime, 'Start Winding Down For Sleep', `Your in-bed target is ${clockLabel(window.idealInBedMinutes)}. You have 1 hour to get ready for ${durationLabel(sleep.sleepNeedMinutes)} of sleep.`, at, '/sleep-window');
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

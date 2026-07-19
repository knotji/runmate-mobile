import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const DAY_MS = 86_400_000;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return reply({ error: 'Authentication Required' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return reply({ error: 'Authentication Required' }, 401);

    const body = await request.json();
    const goal = normalizeGoal(body.goal);
    if (!goal) return reply({ error: 'Complete The Required Race Goal Fields' }, 400);
    const today = bangkokToday();
    if (dateDiff(today, goal.raceDate) < 0) return reply({ error: 'Race Date Must Be Today Or Later' }, 400);
    const fallback = buildFallbackPlan(goal, body.context, today);
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return reply({ data: fallback, source: 'fallback' });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite'}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt(goal, body.context, today) }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
      });
      if (!response.ok) return reply({ data: fallback, source: 'fallback' });
      const generated = await response.json();
      const text = generated?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') return reply({ data: fallback, source: 'fallback' });
      return reply({ data: normalizePlan(JSON.parse(text), fallback), source: 'ai' });
    } catch (error) {
      console.error('[generate-race-plan] AI fallback', error);
      return reply({ data: fallback, source: 'fallback' });
    }
  } catch (error) {
    console.error('[generate-race-plan]', error);
    return reply({ error: 'Race Plan Generation Failed' }, 500);
  }
});

type Goal = { raceName: string; raceDate: string; raceDistance: string; goalType: string; targetTime: string | null; currentLongestRunKm: number | null; trainingDaysPerWeek: number; preferredLongRunDay: string };
type Workout = { day: string; workoutType: string; distanceKm: number | null; durationMin: number | null; targetPace: string | null; targetHR: string | null; description: string; purpose: string | null; adjustment: string | null };

function prompt(goal: Goal, context: unknown, today: string) { return `You are RunMate's cautious running coach. Create a practical seven-day race training plan in English.
Today: ${today}
Race Goal: ${JSON.stringify(goal)}
Recent runner context: ${JSON.stringify(compactContext(context))}

Requirements:
- Use exactly seven workouts, starting with today's weekday and continuing in calendar order.
- Use ${goal.trainingDaysPerWeek} training days at most; remaining days are Rest or Recovery.
- Never increase recent weekly distance aggressively. Prefer conservative progression.
- Include at most two hard sessions and never place hard sessions on consecutive days.
- If current pain, illness, low Recovery, or stale Recovery is present, replace hard work with Easy Run, Walk, Mobility, or Rest.
- Target pace must match the race target and remain realistic. Do not invent medical or wearable data.
- Every target pace boundary must use a 30-second increment only, ending in :00 or :30 (for example 6:30-7:00 min/km). Never return :05, :10, :15, :20, :25, :35, :40, :45, :50, or :55.
- Write every visible string in English.

Return JSON only with: {currentPhase,planSummary,safetyNotes,weeklyPlan:[{day,workoutType,distanceKm,durationMin,targetPace,targetHR,description,purpose,adjustment}],paceGuidance:{recovery,easy,longRun,tempo,interval}}.`; }

function normalizeGoal(value: unknown): Goal | null {
  const g = obj(value); const name = str(g.raceName); const date = str(g.raceDate); const distance = str(g.raceDistance); const goalType = str(g.goalType);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !['5K','10K','Half Marathon','Full Marathon','Custom'].includes(distance ?? '') || !goalType) return null;
  return { raceName: name, raceDate: date!, raceDistance: distance!, goalType, targetTime: str(g.targetTime), currentLongestRunKm: num(g.currentLongestRunKm), trainingDaysPerWeek: clamp(Math.round(num(g.trainingDaysPerWeek) ?? 4), 1, 7), preferredLongRunDay: str(g.preferredLongRunDay) ?? 'Sunday' };
}

function buildFallbackPlan(goal: Goal, contextValue: unknown, today: string) {
  const daysLeft = Math.max(0, dateDiff(today, goal.raceDate));
  const totalWeeks = Math.max(1, Math.ceil(daysLeft / 7));
  const phase = daysLeft <= 7 ? 'Race Week' : daysLeft <= 21 ? 'Sharpen' : daysLeft <= 56 ? 'Build' : 'Base';
  const context = obj(contextValue); const recentKm = num(context.totalRunKm) ?? 0; const recoveryScore = num(context.recoveryScore); const activePain = context.activePain === true; const activeSick = context.activeSick === true;
  const safeOnly = activePain || activeSick || (recoveryScore != null && recoveryScore < 34);
  const raceKm = distanceKm(goal.raceDistance); const longest = goal.currentLongestRunKm ?? (recentKm > 0 ? recentKm * .35 : 6);
  const easyKm = roundHalf(clamp(recentKm > 0 ? recentKm / Math.max(goal.trainingDaysPerWeek, 3) : Math.min(longest, 5), 3, 8));
  const longKm = roundHalf(clamp(daysLeft <= 7 ? Math.min(easyKm, 5) : longest + .5, 4, raceKm ? Math.max(5, raceKm * .8) : 18));
  const targetPace = targetPaceSec(goal); const paces = buildPaces(targetPace);
  const dayNames = Array.from({ length: 7 }, (_, index) => weekdayFrom(today, index));
  const longIndex = Math.max(0, dayNames.findIndex((day) => day.toLowerCase() === goal.preferredLongRunDay.toLowerCase()));
  const desired = safeOnly ? Math.min(3, goal.trainingDaysPerWeek) : goal.trainingDaysPerWeek;
  const runIndexes = new Set<number>([0, longIndex]);
  for (const candidate of [2, 4, 1, 5, 3, 6]) { if (runIndexes.size >= desired) break; runIndexes.add(candidate); }
  const weeklyPlan: Workout[] = dayNames.map((day, index) => {
    if (!runIndexes.has(index)) return workout(day, index % 2 ? 'Rest' : 'Recovery', null, 20, null, 'Easy breathing', 'Restore before the next session.');
    if (safeOnly) return workout(day, 'Easy Run / Walk', easyKm, null, paces.recovery, 'Conversational effort', 'Keep load low while Recovery is limited.');
    if (index === longIndex && daysLeft > 7) return workout(day, 'Long Run', longKm, null, paces.longRun, 'Easy aerobic effort', 'Build endurance without a hard finish.');
    if (index === 2 && phase !== 'Base' && phase !== 'Race Week') return workout(day, phase === 'Sharpen' ? 'Intervals' : 'Tempo Run', 5, null, phase === 'Sharpen' ? paces.interval : paces.tempo, 'Controlled hard effort', 'Build race-specific fitness with control.');
    return workout(day, 'Easy Run', easyKm, null, paces.easy, 'Conversational effort', 'Build consistent aerobic volume.');
  });
  return { raceCountdownText: daysLeft === 0 ? 'Race Day' : `${daysLeft} days until race`, totalWeeks, currentPhase: phase, planSummary: `A conservative ${phase.toLowerCase()} plan for ${goal.raceName}, built around ${desired} training days per week.`, phases: [{ name: phase, weekRange: `1-${totalWeeks}`, focus: phaseFocus(phase), notes: 'Adjust the plan when Recovery, pain, or illness changes.' }], weeks: [{ weekNumber: 1, phase, weeklyFocus: phaseFocus(phase), targetWeeklyDistanceKm: roundHalf(weeklyPlan.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0)), longRunDistanceKm: longKm, workouts: weeklyPlan }], safetyNotes: 'Stop or reduce the session if pain increases, illness develops, or effort is unusually high.', weeksRemaining: totalWeeks, planStartDate: today, todayWorkout: weeklyPlan[0], weeklyPlan, paceGuidance: paces, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function normalizePlan(value: unknown, fallback: ReturnType<typeof buildFallbackPlan>) {
  const data = obj(value); const input = Array.isArray(data.weeklyPlan) ? data.weeklyPlan : []; const weeklyPlan = fallback.weeklyPlan.map((base, index) => normalizeWorkout(input[index], base));
  const phase = str(data.currentPhase) ?? fallback.currentPhase;
  return { ...fallback, currentPhase: phase, planSummary: str(data.planSummary) ?? fallback.planSummary, safetyNotes: str(data.safetyNotes) ?? fallback.safetyNotes, weeklyPlan, todayWorkout: weeklyPlan[0], weeks: [{ ...fallback.weeks[0], phase, workouts: weeklyPlan, targetWeeklyDistanceKm: roundHalf(weeklyPlan.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0)) }], paceGuidance: normalizePaceGuidance(data.paceGuidance, fallback.paceGuidance), updatedAt: new Date().toISOString() };
}
function normalizeWorkout(value: unknown, fallback: Workout): Workout { const w = obj(value); return { day: str(w.day) ?? fallback.day, workoutType: str(w.workoutType) ?? fallback.workoutType, distanceKm: num(w.distanceKm), durationMin: num(w.durationMin), targetPace: normalizePaceText(str(w.targetPace)) ?? fallback.targetPace, targetHR: str(w.targetHR), description: str(w.description) ?? fallback.description, purpose: str(w.purpose), adjustment: str(w.adjustment) }; }
function workout(day: string, workoutType: string, distanceKm: number | null, durationMin: number | null, targetPace: string | null, targetHR: string, description: string): Workout { return { day, workoutType, distanceKm, durationMin, targetPace, targetHR, description, purpose: description, adjustment: 'Reduce or stop if pain rises or effort feels abnormal.' }; }
function buildPaces(target: number | null) { if (!target) return { recovery: null, easy: null, longRun: null, tempo: null, interval: null }; return { recovery: paceRange(target + 90, target + 120), easy: paceRange(target + 60, target + 90), longRun: paceRange(target + 70, target + 100), tempo: paceRange(target + 10, target + 25), interval: paceRange(target - 10, target + 5) }; }
function targetPaceSec(goal: Goal) { const total = durationSec(goal.targetTime); const km = distanceKm(goal.raceDistance); return total && km ? Math.round(total / km) : null; }
function durationSec(value: string | null) { if (!value) return null; const p = value.split(':').map(Number); if (p.some((n) => !Number.isFinite(n))) return null; return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : null; }
function distanceKm(value: string) { return value === '5K' ? 5 : value === '10K' ? 10 : value === 'Half Marathon' ? 21.1 : value === 'Full Marathon' ? 42.2 : null; }
function paceRange(a: number, b: number) { return `${pace(Math.min(a,b), 'floor')}-${pace(Math.max(a,b), 'ceil')}/km`; }
function pace(sec: number, direction: 'floor' | 'ceil' | 'nearest' = 'nearest') { const rounded = direction === 'floor' ? Math.floor(sec/30)*30 : direction === 'ceil' ? Math.ceil(sec/30)*30 : Math.round(sec/30)*30; const n = Math.max(180, rounded); return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; }
function normalizePaceText(value: string | null) {
  if (!value) return null;
  const matches = [...value.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  if (matches.length === 0) return value;
  let index = 0;
  return value.replace(/\b(\d{1,2}):(\d{2})\b/g, (_match, minutes: string, seconds: string) => {
    const total = Number(minutes) * 60 + Number(seconds);
    const direction = matches.length > 1 ? (index++ === 0 ? 'floor' : 'ceil') : 'nearest';
    return pace(total, direction);
  });
}
function normalizePaceGuidance(value: unknown, fallback: ReturnType<typeof buildPaces>) {
  const input = obj(value);
  return Object.fromEntries(Object.entries(fallback).map(([key, fallbackValue]) => [key, normalizePaceText(str(input[key])) ?? fallbackValue]));
}
function compactContext(value: unknown) { const c = obj(value); return { recoveryScore: num(c.recoveryScore), recoveryState: str(c.recoveryState), totalRunKm: num(c.totalRunKm), longestRunKm: num(c.longestRunKm), activePain: c.activePain === true, activeSick: c.activeSick === true }; }
function weekdayFrom(today: string, offset: number) { const date = new Date(`${today}T12:00:00+07:00`); date.setUTCDate(date.getUTCDate()+offset); return new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'Asia/Bangkok'}).format(date); }
function phaseFocus(phase: string) { return phase === 'Race Week' ? 'Reduce load and arrive fresh.' : phase === 'Sharpen' ? 'Practice race-specific speed with low volume.' : phase === 'Build' ? 'Build endurance and controlled quality.' : 'Build consistent aerobic fitness.'; }
function bangkokToday() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function dateDiff(from: string, to: string) { return Math.round((Date.parse(`${to}T12:00:00+07:00`)-Date.parse(`${from}T12:00:00+07:00`))/DAY_MS); }
function reply(body: unknown, status=200) { return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}}); }
function obj(v: unknown): Record<string,unknown> { return v && typeof v === 'object' ? v as Record<string,unknown> : {}; }
function str(v: unknown) { return typeof v === 'string' && v.trim() ? v.trim().slice(0,1000) : null; }
function num(v: unknown) { const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN; return Number.isFinite(n) ? n : null; }
function clamp(v: number,min: number,max: number) { return Math.min(max,Math.max(min,v)); }
function roundHalf(v: number) { return Math.round(v*2)/2; }

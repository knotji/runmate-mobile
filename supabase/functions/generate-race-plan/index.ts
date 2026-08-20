import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasBodyRecompositionGoal, selectStrengthDayIndexes } from './plan-policy.ts';

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
      return reply({ data: normalizePlan(JSON.parse(text), fallback, goal, today), source: 'ai' });
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

function prompt(goal: Goal, context: unknown, today: string) { return `You are WholeMate's cautious running coach. Create a practical seven-day race training plan in English.
Today: ${today}
Race Goal: ${JSON.stringify(goal)}
Recent runner context: ${JSON.stringify(compactContext(context))}

Requirements:
- Use exactly seven workouts, starting with today's weekday and continuing in calendar order.
- Treat recentWorkouts as completed facts. Account for their actual distance and duration instead of assuming the old plan was followed.
- Treat currentWeeklyPlan as the runner's committed schedule. Keep upcoming sessions unless recent load, Recovery, pain, or illness gives a clear reason to adjust them.
- Do not move a missed workout into a later day automatically and do not stack hard sessions to catch up.
- If the runner already trained today, make today's generated entry Recovery or Rest; the app will lock the completed day during reconciliation.
- Use ${goal.trainingDaysPerWeek} training days at most; remaining days are Rest or Recovery.
- Never increase recent weekly distance aggressively. Prefer conservative progression.
- Include at most two hard sessions and never place hard sessions on consecutive days.
- When it fits the runner's phase and available training days, include 1-2 "Strength Training" sessions per week (runner-focused: lower body, core, and stability, not general bodybuilding) in place of an Easy Run or Rest day — never in Race Week (final 7 days before the race), never the day immediately before or after a hard running session, and never if current pain, illness, or low Recovery is present. Do not force a Strength Training session into every plan; skip it when there is no safe, useful slot for one.
- If current pain, illness, low Recovery, or stale Recovery is present, replace hard work or Strength Training with Easy Run, Walk, Mobility, or Rest.
- goalProfile is optional. Primary goal guides prioritization; secondary goals influence trade-offs and supporting recommendations, but must never override safety, Recovery, or the primary training objective. If goalProfile.primaryGoal is "running_consistency", favor an achievable, sustainable ${goal.trainingDaysPerWeek}-day cadence over maximizing volume or intensity. If goalProfile.primaryGoal or any goalProfile.secondaryGoals is "six_pack", "fat_loss", or "muscle_gain", preserve up to 2 Strength Training opportunities this week (not just 1) when Recovery and race phase allow — by using eligible non-running days, never by adding extra running volume or by displacing a running day the primary goal needs.
- Target pace must match the race target and remain realistic. Do not invent medical or wearable data.
- The active Race Goal date is immutable. If it falls inside these seven days, that exact date must be "Race Day" with the goal distance and target pace; it replaces any committed Easy Run or Long Run.
- In Race Week, use a short Race Primer 3-4 days before the race, cap any run 2 days before at 3 km easy, and make the day before the race Rest. Never schedule a hard session in the final 2 days.
- Dates after Race Day must be Rest or Recovery, never normal training.
- Every target pace boundary must use a 30-second increment only, ending in :00 or :30 (for example 6:30-7:00 min/km). Never return :05, :10, :15, :20, :25, :35, :40, :45, :50, or :55.
- Write day, workoutType, targetPace, targetHR, currentPhase, and planSummary in English. Write description, purpose, adjustment, and safetyNotes in Thai — this is the runner-facing coaching guidance and is read in Thai, unlike the rest of the app.

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
  const recentWorkouts = compactRecentWorkouts(context.recentWorkouts); const completedToday = recentWorkouts.some((day) => day.date === today);
  const recentHeavyDay = recentWorkouts.some((day) => dateDiff(day.date, today) >= 0 && dateDiff(day.date, today) <= 1 && (day.runKm >= 8 || day.durationMin >= 60));
  const currentWeeklyPlan = compactWeeklyPlan(context.currentWeeklyPlan);
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
  // One or two non-run days become Strength Training instead of Rest/Recovery,
  // mirroring the AI prompt's own guidance — never in Race Week, never when
  // safety-capped, and up to 2 (rather than 1) when a body-recomposition goal
  // is active — see plan-policy.ts for the shared decision + its own tests.
  const offIndexes = [1, 3, 5, 6, 2, 4].filter((index) => !runIndexes.has(index));
  const bodyRecompositionGoalActive = hasBodyRecompositionGoal(context.goalProfile);
  const strengthAlreadyThisWeek = currentWeeklyPlan.some((item) => item.workoutType === 'Strength Training');
  const strengthIndexes = selectStrengthDayIndexes(offIndexes, { safeOnly, daysLeft, bodyRecompositionGoalActive, strengthAlreadyThisWeek });
  const weeklyPlan: Workout[] = dayNames.map((day, index) => {
    const committed = currentWeeklyPlan.find((entry) => entry.day.toLowerCase() === day.toLowerCase()) ?? null;
    const candidate = committed ?? fallbackWorkout(day, index, runIndexes, safeOnly, longIndex, daysLeft, phase, easyKm, longKm, paces, strengthIndexes);
    if (completedToday && index === 0) return workout(day, 'Recovery', null, 20, null, 'Easy breathing', 'นับรวมกับที่ซ้อมไปแล้ววันนี้ พักฟื้นก่อนเพิ่มโหลดเพิ่ม');
    if (safeOnly && isHardWorkout(candidate.workoutType)) return workout(day, 'Easy Run / Walk', Math.min(candidate.distanceKm ?? easyKm, easyKm), null, paces.recovery, 'Conversational effort', 'คุมโหลดให้เบาไว้ก่อน เพราะ Recovery ยังจำกัดอยู่');
    if (recentHeavyDay && index <= 1 && isHardWorkout(candidate.workoutType)) return workout(day, 'Recovery', null, 20, null, 'Easy breathing', 'โหลดซ้อมช่วงที่ผ่านมาสูง หลีกเลี่ยงการซ้อมหนักซ้อนอีกวัน');
    return { ...candidate, day };
  });
  const alignedWeeklyPlan = enforceRaceWeek(weeklyPlan, goal, today, paces);
  return { raceCountdownText: daysLeft === 0 ? 'Race Day' : `${daysLeft} days until race`, totalWeeks, currentPhase: phase, planSummary: `A conservative ${phase.toLowerCase()} plan for ${goal.raceName}, built around ${desired} training days per week.`, phases: [{ name: phase, weekRange: `1-${totalWeeks}`, focus: phaseFocus(phase), notes: 'Adjust the plan when Recovery, pain, or illness changes.' }], weeks: [{ weekNumber: 1, phase, weeklyFocus: phaseFocus(phase), targetWeeklyDistanceKm: roundHalf(alignedWeeklyPlan.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0)), longRunDistanceKm: longestDistance(alignedWeeklyPlan), workouts: alignedWeeklyPlan }], safetyNotes: 'หยุดหรือลดการซ้อมทันทีถ้าเจ็บมากขึ้น มีอาการป่วย หรือรู้สึกหนักผิดปกติ', weeksRemaining: totalWeeks, planStartDate: today, todayWorkout: alignedWeeklyPlan[0], weeklyPlan: alignedWeeklyPlan, paceGuidance: paces, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function normalizePlan(value: unknown, fallback: ReturnType<typeof buildFallbackPlan>, goal: Goal, today: string) {
  const data = obj(value); const input = Array.isArray(data.weeklyPlan) ? data.weeklyPlan : []; const generatedWeeklyPlan = fallback.weeklyPlan.map((base, index) => normalizeWorkout(input[index], base));
  const weeklyPlan = enforceRaceWeek(generatedWeeklyPlan, goal, today, fallback.paceGuidance);
  const phase = str(data.currentPhase) ?? fallback.currentPhase;
  return { ...fallback, currentPhase: phase, planSummary: str(data.planSummary) ?? fallback.planSummary, safetyNotes: str(data.safetyNotes) ?? fallback.safetyNotes, weeklyPlan, todayWorkout: weeklyPlan[0], weeks: [{ ...fallback.weeks[0], phase, workouts: weeklyPlan, targetWeeklyDistanceKm: roundHalf(weeklyPlan.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0)) }], paceGuidance: normalizePaceGuidance(data.paceGuidance, fallback.paceGuidance), updatedAt: new Date().toISOString() };
}
const WEEKDAY_NAMES = new Set(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
// Gemini occasionally returns an ISO date (e.g. "2026-08-17") in the `day` field
// instead of a weekday name, even though the prompt asks for calendar-order
// weekdays — every downstream consumer (shortDay(), normalizeWeekdayLabel(), the
// Race Goal page's weekly list) expects a weekday name, so an unvalidated date
// string here silently corrupts the UI (e.g. truncated to "202" from "2026-...").
function normalizeWorkoutDay(value: string | null, fallback: string): string {
  return value && WEEKDAY_NAMES.has(value.toLowerCase()) ? value : fallback;
}
function normalizeWorkout(value: unknown, fallback: Workout): Workout { const w = obj(value); return { day: normalizeWorkoutDay(str(w.day), fallback.day), workoutType: str(w.workoutType) ?? fallback.workoutType, distanceKm: num(w.distanceKm), durationMin: num(w.durationMin), targetPace: normalizePaceText(str(w.targetPace)) ?? fallback.targetPace, targetHR: str(w.targetHR), description: str(w.description) ?? fallback.description, purpose: str(w.purpose), adjustment: str(w.adjustment) }; }
function workout(day: string, workoutType: string, distanceKm: number | null, durationMin: number | null, targetPace: string | null, targetHR: string, description: string): Workout { return { day, workoutType, distanceKm, durationMin, targetPace, targetHR, description, purpose: description, adjustment: 'หยุดหรือลดความหนักทันทีถ้ารู้สึกเจ็บหรือรู้สึกผิดปกติ' }; }
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
function compactContext(value: unknown) { const c = obj(value); return { todayDate: str(c.todayDate), recoveryScore: num(c.recoveryScore), recoveryState: str(c.recoveryState), totalRunKm: num(c.totalRunKm), longestRunKm: num(c.longestRunKm), activePain: c.activePain === true, activeSick: c.activeSick === true, recentWorkouts: compactRecentWorkouts(c.recentWorkouts), currentWeeklyPlan: compactWeeklyPlan(c.currentWeeklyPlan), goalProfile: compactGoalProfile(c.goalProfile) }; }
function compactGoalProfile(value: unknown): { primaryGoal: string; secondaryGoals: string[] } | null { const g = obj(value); const primaryGoal = str(g.primaryGoal); if (!primaryGoal) return null; return { primaryGoal, secondaryGoals: arr(g.secondaryGoals).map((item) => str(item)).filter((item): item is string => item !== null).slice(0, 5) }; }
function compactRecentWorkouts(value: unknown) { return arr(value).slice(0,7).map((entry) => { const day=obj(entry); const runs=arr(day.runs).map(obj); const walks=arr(day.walks).map(obj); const other=arr(day.other).map(obj); return { date: str(day.date)?.slice(0,10) ?? '', runKm: roundHalf(runs.reduce((sum,item)=>sum+(num(item.km)??0),0)), durationMin: Math.round([...runs,...walks,...other].reduce((sum,item)=>sum+(num(item.durationMin)??0),0)) }; }).filter((day)=>/^\d{4}-\d{2}-\d{2}$/.test(day.date)); }
function compactWeeklyPlan(value: unknown): Workout[] { return arr(value).slice(0,7).map((entry) => { const item=obj(entry); const day=str(item.day); const workoutType=str(item.workoutType); if(!day||!workoutType)return null; return { day, workoutType, distanceKm:num(item.distanceKm), durationMin:num(item.durationMin), targetPace:normalizePaceText(str(item.targetPace)), targetHR:str(item.targetHR), description:str(item.description)??'', purpose:str(item.purpose), adjustment:str(item.adjustment) }; }).filter((item): item is Workout => item!==null); }
function fallbackWorkout(day:string,index:number,runIndexes:Set<number>,safeOnly:boolean,longIndex:number,daysLeft:number,phase:string,easyKm:number,longKm:number,paces:ReturnType<typeof buildPaces>,strengthIndexes:number[]):Workout { if(strengthIndexes.includes(index))return workout(day,'Strength Training',null,30,null,'Controlled effort','ฝึกความแข็งแรงของกล้ามเนื้อขาและแกนกลางลำตัว เสริมความมั่นคงให้การวิ่ง'); if(!runIndexes.has(index))return workout(day,index%2?'Rest':'Recovery',null,20,null,'Easy breathing','พักฟื้นก่อนซ้อมครั้งถัดไป'); if(safeOnly)return workout(day,'Easy Run / Walk',easyKm,null,paces.recovery,'Conversational effort','คุมโหลดให้เบาไว้ก่อน เพราะ Recovery ยังจำกัดอยู่'); if(index===longIndex&&daysLeft>7)return workout(day,'Long Run',longKm,null,paces.longRun,'Easy aerobic effort','สร้างความทนทาน ไม่ต้องจบด้วยความหนัก'); if(index===2&&phase!=='Base'&&phase!=='Race Week')return workout(day,phase==='Sharpen'?'Intervals':'Tempo Run',5,null,phase==='Sharpen'?paces.interval:paces.tempo,'Controlled hard effort','สร้างความฟิตเฉพาะทางสำหรับการแข่งขันแบบควบคุมได้'); return workout(day,'Easy Run',easyKm,null,paces.easy,'Conversational effort','สร้างปริมาณซ้อมแบบแอโรบิกอย่างสม่ำเสมอ'); }
function enforceRaceWeek(plan:Workout[],goal:Goal,today:string,paces:ReturnType<typeof buildPaces>):Workout[]{return plan.map((item,index)=>{const date=shiftDate(today,index);const before=dateDiff(date,goal.raceDate);if(before===0)return workout(weekdayFrom(today,index),'Race Day',distanceKm(goal.raceDistance),durationSec(goal.targetTime)?Math.round(durationSec(goal.targetTime)!/60):null,targetPaceSec(goal)?`${pace(targetPaceSec(goal)!)}/km`:null,'Race effort',`${goal.raceName} · ${goal.raceDistance} วอร์มอัพเบาๆ แล้วแข่งด้วยความหนักที่ควบคุมได้ตามเป้าเพซ`);if(before===1)return workout(weekdayFrom(today,index),'Rest',null,null,null,'Easy breathing','พักก่อนวันแข่ง เตรียมอุปกรณ์ให้พร้อมและใช้วันนี้แบบสบายๆ');if(before===2&&!/rest|recovery/i.test(item.workoutType))return workout(weekdayFrom(today,index),'Shakeout Run',Math.min(item.distanceKm??3,3),Math.min(item.durationMin??25,25),paces.recovery,'Zone 1–2','วิ่งเบาๆ สั้นๆ คลายกล้ามเนื้อ ให้จบแบบรู้สึกสดชื่นกว่าตอนเริ่ม');if((before===3||before===4)&&isHardWorkout(item.workoutType))return workout(weekdayFrom(today,index),'Race Primer',Math.min(item.distanceKm??4,4),Math.min(item.durationMin??30,30),targetPaceSec(goal)?`${pace(targetPaceSec(goal)!)}/km`:null,'Controlled race effort','วอร์มอัพเบาๆ ตามด้วยความหนักระดับแข่ง 3 x 1 นาที สลับพักเต็มที่ แล้วคูลดาวน์');if(before<0)return workout(weekdayFrom(today,index),'Recovery',null,20,null,'Easy breathing','เดินเบาๆ หรือขยับตัวเบาๆ หลังแข่ง');return item;});}
function longestDistance(plan:Workout[]){const values=plan.map((item)=>item.distanceKm).filter((value):value is number=>value!=null);return values.length?Math.max(...values):null;}
function shiftDate(date:string,days:number){const parsed=new Date(`${date}T12:00:00+07:00`);parsed.setUTCDate(parsed.getUTCDate()+days);return parsed.toISOString().slice(0,10);}
function isHardWorkout(value:string){return /tempo|threshold|interval|speed|repeat|hill|race/i.test(value);}
function weekdayFrom(today: string, offset: number) { const date = new Date(`${today}T12:00:00+07:00`); date.setUTCDate(date.getUTCDate()+offset); return new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'Asia/Bangkok'}).format(date); }
function phaseFocus(phase: string) { return phase === 'Race Week' ? 'Reduce load and arrive fresh.' : phase === 'Sharpen' ? 'Practice race-specific speed with low volume.' : phase === 'Build' ? 'Build endurance and controlled quality.' : 'Build consistent aerobic fitness.'; }
function bangkokToday() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function dateDiff(from: string, to: string) { return Math.round((Date.parse(`${to}T12:00:00+07:00`)-Date.parse(`${from}T12:00:00+07:00`))/DAY_MS); }
function reply(body: unknown, status=200) { return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}}); }
function obj(v: unknown): Record<string,unknown> { return v && typeof v === 'object' ? v as Record<string,unknown> : {}; }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function str(v: unknown) { return typeof v === 'string' && v.trim() ? v.trim().slice(0,1000) : null; }
function num(v: unknown) { const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN; return Number.isFinite(n) ? n : null; }
function clamp(v: number,min: number,max: number) { return Math.min(max,Math.max(min,v)); }
function roundHalf(v: number) { return Math.round(v*2)/2; }

import type { CoachContext, TodayCompletedWorkoutSummary } from '@/lib/buildCoachContext';
import { buildAdaptiveTrainingRecommendation } from '@/lib/adaptiveTrainingPlan';
import { supabase } from '@/lib/supabaseClient';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import type { WeekWorkout } from '@/types/race';

export type AiCoachTopic = 'today' | 'recovery' | 'adjust' | 'fuel' | 'race' | 'chat';

export const AI_COACH_TOPICS: Array<{ id: AiCoachTopic; title: string; summary: string }> = [
  { id: 'today', title: 'What Should I Do Today?', summary: 'Turn today\'s Recovery, plan, and recent logs into one clear priority.' },
  { id: 'recovery', title: 'Why Did My Recovery Change?', summary: 'Understand the available signals behind today\'s Recovery.' },
  { id: 'adjust', title: 'Should I Adjust Today\'s Workout?', summary: 'Compare the planned session with today\'s readiness and safety signals.' },
  { id: 'fuel', title: 'How Should I Fuel Today?', summary: 'Use today\'s logged meals and training load for practical guidance.' },
  { id: 'race', title: 'Am I On Track For My Race?', summary: 'Review your current Race Goal and recent training without rebuilding the plan.' },
];

export type AiCoachAnswer = {
  topic: AiCoachTopic;
  headline: string;
  summary: string;
  actions: string[];
  reasons: string[];
  missingData: string[];
  caution: string | null;
  nextMeal: { title: string; timing: string | null; options: string[] } | null;
  followUps: string[];
  generatedAt: string;
};

export type AiCoachContext = ReturnType<typeof buildAiCoachContext>;

export function buildAiCoachContext(context: CoachContext) {
  const planned = getTodayPlannedWorkout(context);
  const adaptive = buildAdaptiveTrainingRecommendation(context, planned);
  const racePlan = record(context.racePlan);

  return {
    date: context.todayDate,
    timeBangkok: bangkokTime(),
    recovery: {
      state: context.recoverySystem.scoreState,
      freshness: context.recoverySystem.dataFreshness.status,
      score: isRecoveryScored(context) ? Math.round(context.recoverySystem.overallScore) : null,
      label: context.recoverySystem.overallLabel,
      strain: round(context.recoverySystem.strain.score, 1),
      strainEstimated: context.recoverySystem.strain.estimated,
      sleepScore: context.recoverySystem.sleepPerformance.state === 'unscorable'
        ? null
        : Math.round(context.recoverySystem.sleepPerformance.score),
      sleepDuration: formatDuration(context.recoverySystem.sleepPerformance.actualSleepMinutes),
      sleepNeed: formatDuration(context.recoverySystem.sleepPerformance.sleepNeedMinutes),
      sleepShortfall: formatDuration(context.recoverySystem.sleepPerformance.sleepDebtMinutes),
      fuelStatus: context.recoverySystem.fuelInsight.status,
      fuelSummary: context.recoverySystem.fuelInsight.summary,
      usedSignals: context.recoverySystem.sourceCoverage.used.slice(0, 8),
      missingSignals: context.recoverySystem.sourceCoverage.missing.slice(0, 8),
    },
    todayPlan: planned ? {
      status: getTodayTrainingPlanStatus(context, planned),
      workout: compactPlannedWorkout(planned),
      adaptiveRecommendation: adaptive ? {
        action: adaptive.action,
        headline: adaptive.headline,
        summary: adaptive.summary,
        reasons: adaptive.reasons.slice(0, 4),
        suggestedWorkout: compactPlannedWorkout(adaptive.suggestedWorkout),
      } : null,
    } : null,
    todayWorkouts: context.todayWorkouts.slice(0, 6).map(compactCompletedWorkout),
    recentTraining: {
      sessions7d: context.totalSessions,
      runDistanceKm7d: round(context.totalRunKm, 1),
      runDays7d: context.runDays7d,
      longestRunKm7d: context.longestRun7dKm,
      lastWorkoutDate: context.lastWorkoutDate,
    },
    nutritionToday: context.nutritionToday ? {
      meals: context.nutritionToday.mealCount,
      caloriesKcal: context.nutritionToday.caloriesKcal,
      proteinG: context.nutritionToday.proteinG,
      carbsG: context.nutritionToday.carbsG,
      fatG: context.nutritionToday.fatG,
      foods: context.mealsToday.flatMap((meal) => meal.foods).filter(Boolean).slice(0, 12),
      mealLog: context.mealsToday.slice(0, 8).map((meal) => ({
        type: meal.mealType,
        foods: meal.foods.slice(0, 6),
        caloriesKcal: meal.caloriesKcal,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
      })),
    } : null,
    race: context.activeRaceGoal ? {
      status: context.activeRaceStatus,
      name: context.raceName,
      date: context.raceDate,
      distance: context.raceDistance,
      daysUntilRace: context.daysUntilRace,
      targetTime: context.targetTime,
      currentPhase: stringOrNull(racePlan.currentPhase),
      planSummary: stringOrNull(racePlan.planSummary),
    } : null,
    health: {
      activePain: context.activePain,
      painLevel: context.recentMaxPain?.painLevel ?? null,
      painLocation: context.latestPain?.painLocation ?? null,
      activeSick: context.activeSick,
      sickRisk: context.sickRiskLevel,
    },
  };
}

// Keyed by topic + the exact payload that would be sent to the AI, so a
// cached answer is only reused while the underlying RunMate data (Recovery,
// today's plan, nutrition, race status, etc.) is unchanged. Freeform chat
// queries are never cached since each question is effectively unique.
const answerCache = new Map<string, AiCoachAnswer>();

export function clearAiCoachAnswerCache(): void {
  answerCache.clear();
}

export async function askAiCoach(
  topic: AiCoachTopic,
  context: CoachContext,
  userQuery?: string,
  options: { force?: boolean } = {},
): Promise<AiCoachAnswer> {
  const trimmedQuery = userQuery?.trim();
  const cacheKey = trimmedQuery ? null : `${topic}::${JSON.stringify(buildAiCoachContext(context))}`;
  if (cacheKey && !options.force) {
    const cached = answerCache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: { topic, userQuery: trimmedQuery || undefined, context: buildAiCoachContext(context) },
    });
    if (error) throw error;
    const payload = record(data);
    if (payload.error) throw new Error(String(payload.error));
    const answer = record(payload.data ?? payload);
    const normalized = normalizeAnswer(topic, answer);
    if (cacheKey) answerCache.set(cacheKey, normalized);
    return normalized;
  } catch (err) {
    console.warn('[askAiCoach] Remote function call failed or returned error, using local fallback:', err);
    // Not cached: a degraded local fallback should not block a real answer on retry.
    return buildLocalFallbackAnswer(topic, context, userQuery);
  }
}

export async function askAiCoachChat(userQuery: string, context: CoachContext): Promise<AiCoachAnswer> {
  return askAiCoach('chat', context, userQuery);
}

function buildLocalFallbackAnswer(topic: AiCoachTopic, context: CoachContext, userQuery?: string): AiCoachAnswer {
  const recScore = Math.round(context.recoverySystem.overallScore ?? 70);
  const q = (userQuery || '').toLowerCase();
  
  let headline = 'คำแนะนำปรับการซ้อมสำหรับวันนี้';
  let summary = `จากข้อมูลการฟื้นตัว Recovery Score ${recScore}% และภาระการซ้อมล่าสุดของคุณ RunMate AI Coach ขอแนะนำการซ้อมที่เหมาะสมดังนี้`;
  let actions = [
    'วิ่งหรือออกกำลังกายในระดับเบาถึงปานกลาง (Zone 2)',
    'จิ๊บน้ำสม่ำเสมอและพักผ่อนให้เพียงพอ',
  ];
  let reasons = [
    `ระดับการฟื้นตัวอยู่ในเกณฑ์ ${recScore >= 66 ? 'ดี' : recScore >= 34 ? 'ปานกลาง' : 'ควรเน้นพักผ่อน'}`,
  ];

  if (q.includes('ว่ายน้ำ') || q.includes('swim') || q.includes('วิ่ง')) {
    if (recScore >= 60) {
      headline = 'การว่ายน้ำเป็นทางเลือก Cross-Training ที่ดีเยี่ยม!';
      summary = `เมื่อเปรียบเทียบระหว่างการว่ายน้ำกับการวิ่ง ระดับ Recovery ${recScore}% ของคุณสนับสนุนทั้งสองกิจกรรม แต่การว่ายน้ำแรงกระแทกต่ำ (Low-impact) จะช่วยลดภาระข้อต่อขาทั้งหมดได้ดีกว่า`;
      actions = [
        'สลับไปว่ายน้ำแบบเบาๆ 30-45 นาที เพื่อฟื้นฟูกล้ามเนื้อ',
        'หากเลือกวิ่ง ให้เน้นวิ่งเหยาะๆ Easy Run ใน Zone 2',
        'ดื่มน้ำหรือเกลือแร่หลังออกกำลังกายเพื่อทดแทนเหงื่อ',
      ];
      reasons = [
        'การว่ายน้ำช่วยลดแรงกระแทกบริเวณหัวเข่าและข้อเท้า',
        'ระดับ Recovery เหมาะสมกับการออกกำลังกาย Aerobic ปานกลาง',
      ];
    } else {
      headline = 'แนะนำว่ายน้ำผ่อนคลาย (Active Recovery) แทนการวิ่งหนัก';
      summary = `ระดับ Recovery อยู่ที่ ${recScore}% ซึ่งค่อนข้างต่ำ การว่ายน้ำลอยตัวผ่อนคลายจะช่วยฟื้นฟูกล้ามเนื้อได้ดีกว่าการวิ่งหนัก`;
      actions = [
        'ว่ายน้ำผ่อนคลายความเหนื่อยล้า 20-30 นาที',
        'หลีกเลี่ยงการวิ่งเพื่อป้องกันการบาดเจ็บสะสม',
      ];
      reasons = ['แรงกระแทกจากการวิ่งอาจเพิ่มความเครียดสะสมให้กล้ามเนื้อ'];
    }
  } else if (q.includes('กิน') || q.includes('อาหาร') || q.includes('fuel') || topic === 'fuel') {
    headline = 'แนวทางการเติมพลังงานและการฟื้นฟูด้วยอาหาร';
    summary = `การรับประทานอาหารที่มีคาร์โบไฮเดรตเชิงซ้อนและโปรตีนคุณภาพสูงจะช่วยซ่อมแซมกล้ามเนื้อและเติม Glycogen Store`;
    actions = [
      'รับประทานอาหารมื้อหลักหลังซ้อมภายใน 30-60 นาที',
      'เน้นโปรตีนขนาด 1 ฝ่ามือ ร่วมกับคาร์โบไฮเดรตเบาๆ',
    ];
    reasons = ['ร่างกายต้องการโปรตีนในการซ่อมแซมกล้ามเนื้อหลังออกกำลังกาย'];
  }

  return {
    topic,
    headline,
    summary,
    actions,
    reasons,
    missingData: [],
    caution: recScore < 50 ? 'หากรู้สึกปวดข้อหรือเมื่อยล้าสะสม ควรเน้นพักผ่อน' : null,
    nextMeal: (q.includes('กิน') || q.includes('อาหาร') || topic === 'fuel') ? {
      title: 'มื้อถัดไปที่แนะนำ',
      timing: 'ภายใน 1-2 ชั่วโมงนี้',
      options: ['ข้าวอกไก่ย่าง + ผักต้ม', 'ก๋วยเตี๋ยวน้ำใสใส่ไข่ต้ม', 'โยเกิร์ตผสมผลไม้สดและถั่ว'],
    } : null,
    followUps: ['พรุ่งนี้ควรพักไหม?', 'การฟื้นตัวของฉันเป็นอย่างไร?'],
    generatedAt: new Date().toISOString(),
  };
}

function normalizeAnswer(topic: AiCoachTopic, value: Record<string, unknown>): AiCoachAnswer {
  const headline = requiredString(value.headline, 'AI Coach Could Not Build An Answer.');
  const summary = requiredString(value.summary, 'Please try again when more data is available.');
  return {
    topic,
    headline,
    summary,
    actions: stringArray(value.actions, 4),
    reasons: stringArray(value.reasons, 4),
    missingData: stringArray(value.missingData, 4),
    caution: stringOrNull(value.caution),
    nextMeal: normalizeNextMeal(value.nextMeal),
    followUps: stringArray(value.followUps, 3),
    generatedAt: new Date().toISOString(),
  };
}

function compactPlannedWorkout(workout: WeekWorkout) {
  return {
    type: workout.workoutType,
    distanceKm: workout.distanceKm,
    durationMin: workout.durationMin ?? null,
    targetPace: workout.targetPace,
    targetHR: workout.targetHR,
    purpose: workout.purpose ?? workout.description ?? null,
  };
}

function compactCompletedWorkout(workout: TodayCompletedWorkoutSummary) {
  return {
    type: workout.label,
    kind: workout.kind,
    distanceKm: workout.distanceKm,
    durationMin: workout.durationMin,
    averageHR: workout.avgHR,
    pace: workout.pace,
    calories: workout.calories,
  };
}

function isRecoveryScored(context: CoachContext): boolean {
  return context.recoverySystem.scoreState === 'scored' || context.recoverySystem.scoreState === 'calibrating';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requiredString(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 1_000) : null;
}

function stringArray(value: unknown, max: number): string[] {
  return Array.isArray(value) ? value.map(stringOrNull).filter((item): item is string => Boolean(item)).slice(0, max) : [];
}

function normalizeNextMeal(value: unknown): AiCoachAnswer['nextMeal'] {
  const input = record(value);
  const title = stringOrNull(input.title);
  const options = stringArray(input.options, 3);
  return title && options.length ? { title, timing: stringOrNull(input.timing), options } : null;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

function bangkokTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

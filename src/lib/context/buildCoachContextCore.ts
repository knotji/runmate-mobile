import { dedupeSleepItems } from "@/lib/sleepDedupe";
import { dedupeWorkoutItems } from "@/lib/workoutDedupe";
import { buildDailyNutritionBalance } from "@/lib/dailyNutritionBalance";
import type { LocalHistoryItem } from "@/lib/localHistory";
import { getHistoryItemDateKey } from "@/lib/date";
import type { SleepAnalysis, WorkoutAnalysis, BodyCompositionAnalysis } from "@/types/logs";
import type { PainLog } from "@/types/pain";
import type { RaceResult } from "@/types/race";
import type { StrengthLog } from "@/types/strength";
import { calculateRunMateReadiness } from "@/lib/readinessV2";
import { buildRunMateRecoverySystem, type RunMateRecoverySystem } from "@/lib/recoverySystem";
import { buildRunMateRecoveryLoop, type RunMateRecoveryLoop } from "@/lib/recoveryLoop";
import { getPainRecoveryStatus, derivePainRecoveryInput, isPainRecoveryStatus, type PainRecoveryStatus } from "@/lib/painRecovery";
import { getIllnessRiskLevel, getIllnessTrainingDecision, deriveSickLogFlags } from "@/lib/health/illnessGuardrail";
import type { SickLog, SickRiskLevel, SickSymptom, SickSeverity } from "@/types/sick";
import { reconciliationSourceLabel } from "@/lib/reconciliationPolicy";
import { calculateRunMateSleepScore } from "@/lib/runMateSleepScore";
import { formatSleepMinutesShortThai, formatSleepMinutesThai } from "@/lib/sleepDuration";

import type {
  CoachContext,
  DayWorkoutSummary,
  HealthCheckContext,
  PainSummary,
  TodayCompletedWorkoutSummary,
  WeekSleepRow,
} from "./contextTypes";
import {
  averageSleepMinutes,
  buildContextNotes,
  buildNutritionSummaries,
  buildRaceContext,
  compactHealthCheck,
  compactMealForCoach,
  compactRaceResult,
  compareHistoryByEventDateDesc,
  dateBefore,
  englishWorkoutLabel,
  getSleepDurationMinutes,
  isResolvedPainLog,
  normalizeDateString,
  painHasRedFlag,
  parseDurationToMin,
  pickTodayPrimaryWorkout,
  todayBangkok,
  toFiniteNumber,
  workoutKindToTodayKind,
} from "./contextHelpers";

export function buildCoachContext(): CoachContext {
  return buildCoachContextFromData({ items: [], profile: null, raceGoal: null, racePlan: null });
}

export function buildCoachContextFromData(input: {
  items: LocalHistoryItem[];
  profile: Record<string, unknown> | null;
  raceGoal: Record<string, unknown> | null;
  racePlan: Record<string, unknown> | null;
  raceResults?: RaceResult[];
}): CoachContext {
  const today = todayBangkok();
  const cutoff = dateBefore(7);
  const baselineCutoff = dateBefore(30);
  const race = buildRaceContext(input.raceGoal, today);
  const items = input.items.filter((item) => normalizeDateString(item.createdAt));

  const sleepItems = dedupeSleepItems(items.filter((i) => i.type === "sleep"));
  const rawSleepHistory: WeekSleepRow[] = sleepItems.map((item) => {
    const d = item.data as SleepAnalysis;
    const durationMinutes = getSleepDurationMinutes(item);
    return {
      date: getHistoryItemDateKey(item),
      durationH: durationMinutes
        ? formatSleepMinutesThai(durationMinutes)
        : d?.extracted?.sleepDuration ?? null,
      durationMinutes,
      score: null,
      readiness: d?.coach?.readinessScore ?? null,
      restingHR: d?.extracted?.restingHR ?? null,
      restingHRSource: d?.extracted?.restingHRSource ?? null,
      hrv: d?.extracted?.hrv ?? null,
      energyScore: d?.extracted?.energyScore ?? null,
      sleepStartTime: d?.extracted?.sleepStartTime ?? null,
      sleepEndTime: d?.extracted?.sleepEndTime ?? null,
      avgSleepingHeartRate: d?.extracted?.avgSleepingHeartRate ?? null,
      lowestSleepingHeartRate: d?.extracted?.lowestSleepingHeartRate ?? null,
      sleepHeartRateTimeline: d?.extracted?.sleepHeartRateTimeline ?? null,
      timeInBedMinutes: d?.extracted?.timeInBedMinutes ?? null,
      respiratoryRate: d?.extracted?.avgRespiratoryRate ?? null,
      awakeMinutes: d?.extracted?.sleepStageMinutes?.awake ?? d?.extracted?.sleepStageAwakeMinutes ?? null,
      remMinutes: d?.extracted?.sleepStageMinutes?.rem ?? d?.extracted?.sleepStageRemMinutes ?? null,
      lightMinutes: d?.extracted?.sleepStageMinutes?.light ?? d?.extracted?.sleepStageLightMinutes ?? null,
      deepMinutes: d?.extracted?.sleepStageMinutes?.deep ?? d?.extracted?.sleepStageDeepMinutes ?? null,
      sources: item.reconciledSources?.length ? item.reconciledSources : [reconciliationSourceLabel(item)],
      fieldSources: item.fieldSources ?? {},
      lastImportedAt: item.source?.importedAt ?? null,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
  const sleepHistory: WeekSleepRow[] = rawSleepHistory.map((night, index) => ({
    ...night,
    score: calculateRunMateSleepScore([night, ...rawSleepHistory.slice(index + 1, index + 31)].map((candidate) => ({
      durationMinutes: candidate.durationMinutes,
      timeInBedMinutes: candidate.timeInBedMinutes,
      sleepStartTime: candidate.sleepStartTime,
      sleepEndTime: candidate.sleepEndTime,
      remMinutes: candidate.remMinutes,
      lightMinutes: candidate.lightMinutes,
      deepMinutes: candidate.deepMinutes,
    }))).score,
  }));
  const sleepBaseline30d = sleepHistory.filter((night) => night.date >= baselineCutoff);
  const sleep7d = sleepBaseline30d.filter((night) => night.date >= cutoff);

  const scores = sleep7d.map((s) => s.readiness).filter((n): n is number => n != null);
  const avgReadiness = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const avgSleepMinutes = averageSleepMinutes(sleep7d);
  const sleepAvg7dHours = avgSleepMinutes != null ? Math.round((avgSleepMinutes / 60) * 10) / 10 : null;
  const sleepAvg7dText = avgSleepMinutes != null ? formatSleepMinutesShortThai(avgSleepMinutes) : null;
  const latestSleep = sleep7d[0] ?? null;
  const latestSleepDurationText = latestSleep?.durationMinutes ? formatSleepMinutesThai(latestSleep.durationMinutes) : latestSleep?.durationH ?? null;

  const reconciledWorkoutItems = dedupeWorkoutItems(items.filter((i) => i.type === "workout" || i.type === "strength"));
  const workoutItems = reconciledWorkoutItems
    .filter((i) => i.type === "workout")
    .filter((i) => getHistoryItemDateKey(i) >= cutoff);

  const strengthItems = reconciledWorkoutItems
    .filter((i) => i.type === "strength")
    .filter((i) => getHistoryItemDateKey(i) >= cutoff);

  const dayMap = new Map<string, DayWorkoutSummary>();
  const ensureDay = (date: string) => {
    if (!dayMap.has(date)) dayMap.set(date, { date, runs: [], walks: [], other: [] });
    return dayMap.get(date)!;
  };

  let totalRunKm = 0;
  let totalSessions = 0;
  let longestRun7dKm: number | null = null;
  let lastRun: CoachContext["lastRun"] = null;
  const todayWorkouts: TodayCompletedWorkoutSummary[] = [];

  for (const item of workoutItems) {
    const date = getHistoryItemDateKey(item);
    const d = item.data as WorkoutAnalysis;
    const ext = d?.extracted;
    if (!ext) continue;

    const durationMin = parseDurationToMin(ext.duration);
    const distanceKm = toFiniteNumber(ext.distanceKm);
    const avgHR = toFiniteNumber(ext.avgHR);
    const calories = toFiniteNumber(ext.calories);
    if (date === today) {
      todayWorkouts.push({
        date,
        kind: workoutKindToTodayKind(ext.workoutKind),
        label: englishWorkoutLabel(ext.workoutName, ext.workoutKind),
        distanceKm,
        durationMin,
        durationText: typeof ext.duration === "string" && ext.duration.trim() ? ext.duration : null,
        avgHR,
        pace: ext.avgPace ?? null,
        calories,
      });
    }
    if (!durationMin) continue;

    const day = ensureDay(date);
    totalSessions++;

    if (ext.workoutKind === "outdoor_run" || ext.workoutKind === "treadmill") {
      const km = distanceKm ?? 0;
      totalRunKm += km;
      day.runs.push({ km, durationMin, avgHR, pace: ext.avgPace ?? null });
      longestRun7dKm = Math.max(longestRun7dKm ?? 0, km);
      if (!lastRun || date > lastRun.date) {
        lastRun = { date, km, durationMin, avgHR, pace: ext.avgPace ?? null };
      }
    } else if (ext.workoutKind === "walk") {
      day.walks.push({ km: distanceKm, durationMin });
    } else if (ext.workoutKind === "swimming") {
      day.other.push({ label: "ว่ายน้ำ", durationMin });
    } else {
      const label = ext.workoutKind === "strength" ? "เวท" : ext.workoutKind === "cycling" ? "ปั่นจักรยาน" : "ออกกำลังกาย";
      day.other.push({ label, durationMin });
    }
  }

  for (const item of strengthItems) {
    const date = getHistoryItemDateKey(item);
    const d = item.data as StrengthLog;
    if (!d) continue;
    const durationMin = toFiniteNumber(d.durationMin) ?? 15;

    const day = ensureDay(date);
    totalSessions++;
    day.other.push({ label: `เวท (${d.routineName})`, durationMin });
    if (date === today) {
      todayWorkouts.push({
        date,
        kind: "strength",
        label: d.routineName?.trim() || "Strength Training",
        distanceKm: null,
        durationMin,
        durationText: `${durationMin} นาที`,
        avgHR: null,
        pace: null,
        calories: null,
      });
    }
  }

  const workouts7d = [...dayMap.values()].sort((a, b) => b.date.localeCompare(a.date));
  const nutrition7d = buildNutritionSummaries(items, cutoff);
  const nutritionToday = nutrition7d.find((day) => day.date === today) ?? null;
  const yesterdayDate = dateBefore(1);
  const nutritionYesterday = nutrition7d.find((day) => day.date === yesterdayDate) ?? null;
  const workoutsYesterday = workouts7d.find((day) => day.date === yesterdayDate) ?? null;
  const mealsToday = items
    .filter((item) => item.type === "meal" && getHistoryItemDateKey(item) === today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(compactMealForCoach);
  const latestHealthCheck = items
    .filter((i) => i.type === "health_check")
    .sort(compareHistoryByEventDateDesc)
    .map(compactHealthCheck)
    .find((item): item is HealthCheckContext => Boolean(item)) ?? null;
  const recentRaceResults = (input.raceResults ?? []).map(compactRaceResult);
  for (const result of recentRaceResults.filter((raceResult) => raceResult.raceDate === today)) {
    todayWorkouts.push({
      date: today,
      kind: "race",
      label: result.raceName ? `Race ${result.raceName}` : "Race Result",
      distanceKm: toFiniteNumber(result.actualDistanceKm),
      durationMin: parseDurationToMin(result.actualTime ?? null),
      durationText: result.actualTime ?? null,
      avgHR: toFiniteNumber(result.avgHr),
      pace: result.actualPace ?? null,
      calories: null,
    });
  }
  const latestCompletedRace = recentRaceResults[0] ?? null;
  const runDays7d = workouts7d.filter((day) => day.runs.length > 0).length;
  const lastWorkoutDate = workouts7d[0]?.date ?? null;
  const todayPrimaryWorkout = pickTodayPrimaryWorkout(todayWorkouts);

  // Pain logs — last 7 days, most recent first
  const painItems = items
    .filter((i) => i.type === "pain")
    .filter((i) => getHistoryItemDateKey(i) >= cutoff)
    .sort(compareHistoryByEventDateDesc);
  const recentPainLogs: PainSummary[] = painItems.map((item) => {
    const d = item.data as PainLog;
    const redFlags = Array.isArray(d?.redFlags) ? d.redFlags : [];
    const painType = Array.isArray(d?.painType) ? d.painType : [];
    const painLevel = Number.isFinite(Number(d?.painLevel)) ? Number(d?.painLevel) : 0;
    const baseResolved = isResolvedPainLog(d, redFlags, painType);
    const baseHasActivePain = !baseResolved && (
      painLevel > 0
      || painHasRedFlag({
        swellingOrRedness: d?.swellingOrRedness,
        canBearWeight: d?.canBearWeight,
        redFlags,
        painType,
      })
    );

    const storedStatus = d?.recoveryStatus;
    let resolved = baseResolved;
    let hasActivePain = baseHasActivePain;
    if (storedStatus === "active_pain") {
      hasActivePain = true;
      resolved = false;
    } else if (storedStatus === "improving") {
      hasActivePain = false;
      resolved = false;
    } else if (storedStatus === "cleared_light" || storedStatus === "cleared_normal") {
      hasActivePain = false;
      resolved = true;
    }

    return {
      id: item.id,
      date: getHistoryItemDateKey(item),
      painLocation: d?.painLocation ?? "ไม่ระบุ",
      painSide: d?.painSide ?? "unknown",
      painLevel,
      startedWhen: d?.startedWhen ?? "unknown",
      riskLevel: d?.riskLevel ?? "unknown",
      trainingImpact: d?.trainingImpact ?? "unknown",
      coachAdvice: d?.coachAdvice ?? "",
      swellingOrRedness: d?.swellingOrRedness ?? "unknown",
      canBearWeight: d?.canBearWeight ?? "unknown",
      redFlags,
      painType,
      painStatus: resolved ? "resolved" : "active",
      hasActivePain,
      hasResolvedPain: resolved,
      resolved,
      resolvedAt: d?.resolvedAt ?? null,
      recoveryStatus: storedStatus,
    };
  });
  const recentPainCutoff3d = dateBefore(3);
  const latestPain = recentPainLogs[0] ?? null;
  const recentMaxPain = recentPainLogs
    .filter((pain) => pain.date >= recentPainCutoff3d)
    .reduce<PainSummary | null>((max, pain) => (!max || pain.painLevel > max.painLevel ? pain : max), null);
  const activePain = Boolean(latestPain?.hasActivePain);
  const painResolved = Boolean(latestPain?.hasResolvedPain);
  const recentPainHistory = Boolean(
    recentMaxPain
    && recentMaxPain.painLevel >= 3
    && (painResolved || recentMaxPain.painLevel > (latestPain?.painLevel ?? 0))
  );

  const avgHRV7d = (() => {
    const vals = sleep7d.map((s) => s.hrv).filter((v): v is number => v != null);
    return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();
  const avgRestingHR7d = (() => {
    const vals = sleep7d.map((s) => s.restingHR).filter((v): v is number => v != null);
    return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  const nutritionBalanceToday = mealsToday.length > 0
    ? buildDailyNutritionBalance({
        dateKey: today,
        mealsToday,
        latestHealthCheck,
        todayPrimaryWorkout: pickTodayPrimaryWorkout(todayWorkouts),
        isRecoveryDay: todayWorkouts.length === 0,
      })
    : null;

  const latestBodyItem = items
    .filter((i) => i.type === "body")
    .sort(compareHistoryByEventDateDesc)[0];
  let latestBody: CoachContext["latestBody"] = null;
  if (latestBodyItem) {
    const bd = latestBodyItem.data as BodyCompositionAnalysis;
    latestBody = {
      weightKg: bd?.extracted?.weightKg ?? null,
      bodyFatPct: bd?.extracted?.bodyFatPercent ?? null,
      muscleKg: bd?.extracted?.skeletalMuscleKg ?? null,
    };
  }

  const readinessV2 = calculateRunMateReadiness({
    sleepScore:       latestSleep?.score ?? null,
    sleepDurationMin: latestSleep?.durationMinutes ?? null,
    hrv:              latestSleep?.hrv ?? null,
    restingHR:        latestSleep?.restingHR ?? null,
    avgHRV7d,
    avgRestingHR7d,
    hasSleepToday:    latestSleep?.date === today,
    totalRunKm7d:     totalRunKm,
    runDays7d,
    longestRun7dKm,
    hasWorkoutToday:  todayWorkouts.length > 0,
    todayWorkoutKind: todayPrimaryWorkout?.kind ?? null,
    todayWorkoutKm:   todayPrimaryWorkout?.distanceKm ?? null,
    hasWorkoutData7d: workouts7d.length > 0,
    mealsToday:       mealsToday.length,
    proteinStatus:    nutritionBalanceToday?.proteinStatus ?? null,
    carbStatus:       nutritionBalanceToday?.carbStatus ?? null,
    hasMealData:      mealsToday.length > 0,
    activePain,
    latestPainLevel:  latestPain?.painLevel ?? null,
    painHasRedFlag:   latestPain
      ? latestPain.swellingOrRedness === "yes"
        || latestPain.canBearWeight === "no"
        || latestPain.redFlags.length > 0
        || latestPain.painType.some((t: string) => /sharp|numb|แปลบ|ชา/i.test(t))
      : false,
  });

  const sickItems = items
    .filter((i) => i.type === "sick")
    .filter((i) => getHistoryItemDateKey(i) === today)
    .sort(compareHistoryByEventDateDesc);
  const latestSick: SickLog | null = (() => {
    const item = sickItems[0];
    if (!item) return null;
    const d = item.data as Partial<SickLog> | null;
    if (!d) return null;
    const healthStatus = (d.healthStatus === "normal" || d.healthStatus === "fatigue" || d.healthStatus === "sick") ? d.healthStatus : "sick";
    const symptoms: SickSymptom[] = Array.isArray(d.symptoms) ? d.symptoms as SickSymptom[] : [];
    const severity = (d.severity === "mild" || d.severity === "moderate" || d.severity === "severe") ? d.severity as SickSeverity : undefined;
    const flags = deriveSickLogFlags(symptoms, severity);
    const riskLevel = getIllnessRiskLevel({ healthStatus, symptoms, severity });
    const trainingDecision = getIllnessTrainingDecision(riskLevel);
    return {
      date: getHistoryItemDateKey(item),
      createdAt: item.createdAt,
      healthStatus,
      symptoms,
      severity,
      note: typeof d.note === "string" ? d.note : undefined,
      ...flags,
      riskLevel,
      trainingDecision,
      source: "manual" as const,
    };
  })();
  const activeSick = latestSick !== null && latestSick.healthStatus !== "normal";
  const sickRiskLevel: SickRiskLevel = latestSick?.riskLevel ?? "none";

  const ctx: CoachContext = {
    profile: input.profile,
    raceGoal: input.raceGoal,
    racePlan: input.racePlan,
    activeRaceStatus: race.activeRaceStatus,
    activeRaceGoal: input.raceGoal,
    raceDate: race.raceDate,
    raceDistance: race.raceDistance,
    raceName: race.raceName,
    daysUntilRace: race.daysUntilRace,
    isRaceToday: race.isRaceToday,
    isRaceTomorrow: race.isRaceTomorrow,
    isRaceWeek: race.isRaceWeek,
    raceGoalType: race.raceGoalType,
    targetTime: race.targetTime,
    sleep7d,
    sleepHistory,
    sleepBaseline30d,
    avgReadiness,
    sleepAvg7dHours,
    sleepAvg7dText,
    sleepNightCount7d: sleep7d.length,
    latestSleepDurationText,
    latestSleepScore: latestSleep?.score ?? null,
    latestEnergyScore: latestSleep?.energyScore ?? null,
    latestSleepDateKey: latestSleep?.date ?? null,
    workouts7d,
    hasWorkoutToday: todayWorkouts.length > 0,
    todayWorkouts,
    todayPrimaryWorkout,
    nutritionToday,
    nutrition7d,
    nutritionYesterday,
    mealsToday,
    yesterdayDate,
    workoutsYesterday,
    latestCompletedRace,
    recentRaceResults,
    latestHealthCheck,
    totalRunKm: Math.round(totalRunKm * 10) / 10,
    totalSessions,
    runDays7d,
    longestRun7dKm,
    lastWorkoutDate,
    lastRun,
    latestBody,
    todayDate: today,
    recentPainLogs,
    latestPain,
    recentMaxPain,
    activePain,
    recentPainHistory,
    painResolved,
    painRecoveryStatus: (() => {
      const override = latestPain?.recoveryStatus;
      if (override && isPainRecoveryStatus(override)) return override as PainRecoveryStatus;
      return getPainRecoveryStatus(derivePainRecoveryInput({
        activePain,
        latestPain,
        recentPainLogs,
        workouts7d,
        todayDate: today,
      }));
    })(),
    nutritionBalanceToday,
    readinessV2,
    contextNotes: buildContextNotes({
      raceGoal: input.raceGoal,
      racePlan: input.racePlan,
      raceResults: recentRaceResults,
      sleep7d,
      workouts7d,
      hasWorkoutToday: todayWorkouts.length > 0,
      todayPrimaryWorkout,
      todayWorkouts,
      totalRunKm,
      runDays7d,
      longestRun7dKm,
      lastWorkoutDate,
      sleepAvg7dText,
      sleepNightCount7d: sleep7d.length,
      latestSleepDurationText,
      latestSleepScore: latestSleep?.score ?? null,
      latestEnergyScore: latestSleep?.energyScore ?? null,
      latestSleepDateKey: latestSleep?.date ?? null,
      recentPainLogs,
      latestPain,
      recentMaxPain,
      latestHealthCheck,
      mealsToday,
      nutritionBalanceToday,
      strengthCount: items.filter((i) => i.type === "strength" && getHistoryItemDateKey(i) >= cutoff).length,
    }),
    recoverySystem: null as unknown as RunMateRecoverySystem,
    recoveryLoop: null as unknown as RunMateRecoveryLoop,
    latestSick,
    activeSick,
    sickRiskLevel,
    autoSyncedToday: {
      sleep: items.some((i) => i.type === "sleep" && i.id.startsWith("ghealth-sleep-") && getHistoryItemDateKey(i) === today),
      workout: items.some((i) => i.type === "workout" && (i.id.startsWith("ghealth-exercise-") || i.id.startsWith("healthconnect-samsung-workout-")) && getHistoryItemDateKey(i) === today),
    },
  };

  ctx.recoverySystem = buildRunMateRecoverySystem(ctx);
  ctx.recoveryLoop = buildRunMateRecoveryLoop(ctx, ctx.recoverySystem);
  return ctx;
}

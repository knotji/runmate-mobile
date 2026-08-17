import type { DailyNutritionBalance } from "@/lib/dailyNutritionBalance";
import type { HealthCheckAnalysis } from "@/types/logs";
import type { RaceResult } from "@/types/race";
import type { ReadinessV2Result } from "@/lib/readinessV2";
import type { RunMateRecoverySystem } from "@/lib/recoverySystem";
import type { RunMateRecoveryLoop } from "@/lib/recoveryLoop";
import type { PainRecoveryStatus } from "@/lib/painRecovery";
import type { SickLog, SickRiskLevel } from "@/types/sick";

export type DayWorkoutSummary = {
  date: string;
  runs: { km: number; durationMin: number; avgHR: number | null; pace: string | null }[];
  walks: { km: number | null; durationMin: number }[];
  other: { label: string; durationMin: number }[];
};

export type TodayCompletedWorkoutSummary = {
  date: string;
  kind: "run" | "walk" | "strength" | "cycling" | "race" | "other";
  label: string;
  distanceKm: number | null;
  durationMin: number | null;
  durationText: string | null;
  avgHR: number | null;
  pace: string | null;
  calories: number | null;
};

export type WeekSleepRow = {
  date: string;
  durationH: string | null;
  durationMinutes: number | null;
  score: number | null;
  readiness: number | null;
  restingHR: number | null;
  restingHRSource?: "measured" | "estimated_sleep_hr" | null;
  hrv: number | null;
  energyScore: number | null;
  sleepStartTime: string | null;
  sleepEndTime: string | null;
  avgSleepingHeartRate?: number | null;
  lowestSleepingHeartRate?: number | null;
  sleepHeartRateTimeline?: { at: string; bpm: number }[] | null;
  timeInBedMinutes: number | null;
  respiratoryRate: number | null;
  awakeMinutes: number | null;
  remMinutes: number | null;
  lightMinutes: number | null;
  deepMinutes: number | null;
  sources?: string[];
  fieldSources?: Record<string, string>;
  lastImportedAt?: string | null;
};

export type PainSummary = {
  id: string;
  date: string;
  painLocation: string;
  painSide: string;
  painLevel: number;
  startedWhen: string; // "before_run" | "during_run" | "after_run" | "next_morning" | "unknown"
  riskLevel: string;
  trainingImpact: string;
  coachAdvice: string;
  swellingOrRedness: string;
  canBearWeight: string;
  redFlags: string[];
  painType: string[];
  painStatus: "active" | "resolved";
  hasActivePain: boolean;
  hasResolvedPain: boolean;
  resolved: boolean;
  resolvedAt: string | null;
  recoveryStatus?: string; // user-set override, matches PainRecoveryStatus values
};

export type NutritionDaySummary = {
  date: string;
  mealCount: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string[];
};

export type MealContextSummary = {
  mealType: string;
  foods: string[];
  /** When the meal was logged. This is not necessarily the consumption time. */
  loggedAt?: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  fatLoad: string | null;
  coachNote: string | null;
  isQuickProteinOnly?: boolean;
};

export type HealthCheckContext = {
  checkupDate: string | null;
  createdAt: string;
  nutritionFlags: HealthCheckAnalysis["nutritionFlags"];
  coachSummary: string;
  foodGuidance: HealthCheckAnalysis["foodGuidance"];
  keyLabs: { key: string; label: string; value: string; status: string }[];
  confidence: HealthCheckAnalysis["confidence"];
};

export type CoachContext = {
  profile: Record<string, unknown> | null;
  raceGoal: Record<string, unknown> | null;
  racePlan: Record<string, unknown> | null;
  activeRaceStatus: "none" | "scheduled" | "today" | "past";
  activeRaceGoal: Record<string, unknown> | null;
  raceDate: string | null;
  raceDistance: string | null;
  raceName: string | null;
  daysUntilRace: number | null;
  isRaceToday: boolean;
  isRaceTomorrow: boolean;
  isRaceWeek: boolean;
  raceGoalType: string | null;
  targetTime: string | null;
  sleep7d: WeekSleepRow[];
  /** All deduped sleep records available to the Sleep Details history view. */
  sleepHistory: WeekSleepRow[];
  /** Up to 30 nights for personalized HRV/RHR and sleep-need baselines. */
  sleepBaseline30d: WeekSleepRow[];
  avgReadiness: number | null;
  sleepAvg7dHours: number | null;
  sleepAvg7dText: string | null;
  sleepNightCount7d: number;
  latestSleepDurationText: string | null;
  latestSleepScore: number | null;
  latestEnergyScore: number | null;
  latestSleepDateKey: string | null;
  workouts7d: DayWorkoutSummary[];
  hasWorkoutToday: boolean;
  todayWorkouts: TodayCompletedWorkoutSummary[];
  todayPrimaryWorkout: TodayCompletedWorkoutSummary | null;
  nutritionToday: NutritionDaySummary | null;
  nutrition7d: NutritionDaySummary[];
  nutritionYesterday: NutritionDaySummary | null;
  mealsToday: MealContextSummary[];
  yesterdayDate: string;
  workoutsYesterday: DayWorkoutSummary | null;
  latestCompletedRace: RaceResult | null;
  recentRaceResults: RaceResult[];
  latestHealthCheck: HealthCheckContext | null;
  totalRunKm: number;
  totalSessions: number;
  runDays7d: number;
  weeklyTrainingLoad7d: number;
  longestRun7dKm: number | null;
  lastWorkoutDate: string | null;
  lastRun: { date: string; km: number; durationMin: number; avgHR: number | null; pace: string | null } | null;
  latestBody: { weightKg: number | null; bodyFatPct: number | null; muscleKg: number | null } | null;
  todayDate: string;
  contextNotes: string[];
  recentPainLogs: PainSummary[];
  latestPain: PainSummary | null;
  recentMaxPain: PainSummary | null;
  activePain: boolean;
  recentPainHistory: boolean;
  painResolved: boolean;
  painRecoveryStatus: PainRecoveryStatus;
  nutritionBalanceToday: DailyNutritionBalance | null;
  readinessV2: ReadinessV2Result | null;
  recoverySystem: RunMateRecoverySystem;
  recoveryLoop: RunMateRecoveryLoop;
  // Sick-day guardrail
  latestSick: SickLog | null;
  activeSick: boolean;
  sickRiskLevel: SickRiskLevel;
  // Google Health auto-sync: which types already have a synced entry for today,
  // keyed by history_items id prefix ("ghealth-sleep-"/"ghealth-exercise-").
  autoSyncedToday: { sleep: boolean; workout: boolean };
};

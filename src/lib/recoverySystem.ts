import type { CoachContext, TodayCompletedWorkoutSummary } from './buildCoachContext';
import { formatSleepMinutesThai } from './sleepDuration';

export type RecoveryAxisStatus = 'low' | 'moderate' | 'good' | 'high';
export type RecoveryScoreState = 'scored' | 'pending' | 'calibrating' | 'unscorable' | 'stale';

export type RecoveryDataFreshness = {
  status: 'today' | 'stale' | 'missing';
  latestSleepDate: string | null;
  ageDays: number | null;
};

export type RecoveryAxis = {
  key: 'recovery' | 'load' | 'sleep' | 'fuel';
  score: number;
  status: RecoveryAxisStatus;
  label: string;
  summary: string;
  reasons: string[];
  missing?: string[];
};

export type StrainSummary = {
  score: number;
  scaleMax: 21;
  level: 'light' | 'moderate' | 'high' | 'all_out';
  label: string;
  summary: string;
  estimated: boolean;
  reasons: string[];
  weeklyTrend: { sessions: number; distanceKm: number };
};

export type SleepPerformanceSummary = {
  score: number;
  state: RecoveryScoreState;
  label: string;
  summary: string;
  estimated: boolean;
  sleepNeedMinutes: number;
  actualSleepMinutes: number | null;
  sufficiencyScore: number | null;
  consistencyScore: number | null;
  qualityScore: number | null;
  efficiencyScore: number | null;
  sleepDebtMinutes: number;
  targetWakeTime: string | null;
  targetSleepTime: string | null;
  recommendedInBedTime: string | null;
  reasons: string[];
  missing: string[];
};

export type FuelInsight = {
  status: 'ready' | 'top_up' | 'low' | 'unknown';
  label: string;
  summary: string;
  reasons: string[];
};

export type RecoverySystemOverrides = {
  sleepScore?: number | null;
  energyScore?: number | null;
  yesterdayLoad?: 'none' | 'light' | 'heavy';
  muscleSoreness?: 'none' | 'light' | 'sore';
  injuryFlag?: boolean;
};

export interface OverallDisplayStatus {
  score: number;
  label: 'Low' | 'Fair' | 'Good' | 'Excellent';
  thaiLabel: string;
  displayLabel: string;
  cautionLevel: 'none' | 'light' | 'moderate' | 'high';
  note?: string;
}

export type RunMateRecoverySystem = {
  model: 'whoop_style_v1';
  scoreState: RecoveryScoreState;
  dataFreshness: RecoveryDataFreshness;
  overallScore: number;
  overallLabel: 'Low' | 'Fair' | 'Good' | 'Excellent';
  overallDisplayStatus: OverallDisplayStatus;
  coachingState: 'push' | 'maintain' | 'easy' | 'recover';
  headline: string;
  recovery: RecoveryAxis;
  strain: StrainSummary;
  sleepPerformance: SleepPerformanceSummary;
  fuelInsight: FuelInsight;
  /** Compatibility view for existing readiness/recovery-loop helpers. */
  axes: {
    recovery: RecoveryAxis;
    load: RecoveryAxis;
    sleep: RecoveryAxis;
    fuel: RecoveryAxis;
  };
  guardrails: string[];
  recommendedIntensity: 'rest' | 'walk' | 'easy' | 'moderate' | 'hard';
  sourceCoverage: { used: string[]; missing: string[] };
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = (value: number) => Math.round(value);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function circularTimeMinutes(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < 12 * 60) minutes += 24 * 60;
  return minutes;
}

function variabilityScore(values: number[]): number | null {
  if (values.length < 3) return null;
  const average = mean(values);
  if (average == null) return null;
  const averageDeviation = mean(values.map((value) => Math.abs(value - average))) ?? 0;
  return round(clamp(100 - averageDeviation / 1.2));
}

function formatClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

function recoveryStatus(score: number): RecoveryAxisStatus {
  if (score >= 67) return 'high';
  if (score >= 50) return 'good';
  if (score >= 34) return 'moderate';
  return 'low';
}

function recoveryLabel(score: number): string {
  if (score >= 67) return 'พร้อม';
  if (score >= 34) return 'ปานกลาง';
  return 'ฟื้นตัวต่ำ';
}

export function getOverallDisplayStatus(
  overallScore: number,
  _recoveryScore: number,
  _loadScore: number,
  _sleepScore: number,
  _fuelScore: number,
  activePain: boolean,
  _painResolvedOrHistory: boolean,
): OverallDisplayStatus {
  void _painResolvedOrHistory;
  const score = round(clamp(overallScore));
  let label: OverallDisplayStatus['label'] = score >= 80 ? 'Excellent' : score >= 67 ? 'Good' : score >= 34 ? 'Fair' : 'Low';
  let thaiLabel = score >= 67 ? 'พร้อมรับโหลด' : score >= 34 ? 'พร้อมปานกลาง' : 'ควรฟื้นตัว';
  if (activePain) {
    label = score < 34 ? 'Low' : 'Fair';
    thaiLabel = 'ระวังอาการเจ็บ';
  }
  return {
    score,
    label,
    thaiLabel,
    displayLabel: label,
    cautionLevel: activePain || score < 34 ? 'high' : score < 67 ? 'moderate' : 'none',
    note: activePain ? 'มีอาการเจ็บที่ต้องใช้เป็น safety cap แม้สัญญาณอื่นจะดูดี' : undefined,
  };
}

function buildSleepPerformance(context: CoachContext, strainScore: number): SleepPerformanceSummary {
  const nights = context.sleepBaseline30d;
  const latest = nights[0] ?? null;
  const durations = nights.map((night) => night.durationMinutes).filter((value): value is number => value != null);
  const baselineMinutes = median(durations.slice(1)) ?? median(durations) ?? 8 * 60;
  const debtMinutes = round(Math.min(120, durations.slice(0, 5).reduce((debt, duration) => debt + Math.max(0, baselineMinutes - duration) * 0.25, 0)));
  const strainNeed = round((strainScore / 21) * 60);
  const sleepNeedMinutes = round(clamp(baselineMinutes + debtMinutes + strainNeed, 7 * 60, 10 * 60));
  const actualSleepMinutes = latest?.durationMinutes ?? null;
  const sufficiencyScore = actualSleepMinutes == null ? null : round(clamp(actualSleepMinutes / sleepNeedMinutes * 100));
  const bedtimes = nights.map((night) => circularTimeMinutes(night.sleepStartTime)).filter((value): value is number => value != null);
  const wakeTimes = nights.map((night) => circularTimeMinutes(night.sleepEndTime)).filter((value): value is number => value != null);
  const bedtimeConsistency = variabilityScore(bedtimes);
  const wakeConsistency = variabilityScore(wakeTimes);
  const consistencyParts = [bedtimeConsistency, wakeConsistency].filter((value): value is number => value != null);
  const consistencyScore = consistencyParts.length ? round(mean(consistencyParts) ?? 0) : null;
  const efficiencyScore = latest?.durationMinutes != null && latest.timeInBedMinutes != null && latest.timeInBedMinutes > 0
    ? round(clamp(latest.durationMinutes / latest.timeInBedMinutes * 100))
    : null;
  const restorativeMinutes = (latest?.remMinutes ?? 0) + (latest?.deepMinutes ?? 0);
  const stagedSleepMinutes = restorativeMinutes + (latest?.lightMinutes ?? 0);
  const stageQualityScore = stagedSleepMinutes > 0 ? round(clamp(restorativeMinutes / stagedSleepMinutes / 0.4 * 100)) : null;
  const qualityParts = [latest?.score ?? null, stageQualityScore].filter((value): value is number => value != null);
  const qualityScore = qualityParts.length ? round(mean(qualityParts) ?? 0) : null;
  const components: Array<{ score: number; weight: number }> = [];
  if (sufficiencyScore != null) components.push({ score: sufficiencyScore, weight: 0.55 });
  if (consistencyScore != null) components.push({ score: consistencyScore, weight: 0.15 });
  if (efficiencyScore != null) components.push({ score: efficiencyScore, weight: 0.15 });
  if (qualityScore != null) components.push({ score: qualityScore, weight: 0.15 });
  const weightTotal = components.reduce((sum, item) => sum + item.weight, 0);
  const score = weightTotal ? round(components.reduce((sum, item) => sum + item.score * item.weight, 0) / weightTotal) : 0;
  const missing: string[] = [];
  if (actualSleepMinutes == null) missing.push('ระยะเวลานอนล่าสุด');
  if (consistencyScore == null) missing.push('เวลาเข้านอนและตื่นอย่างน้อย 3 คืน');
  if (qualityScore == null) missing.push('คะแนนคุณภาพการนอน');
  if (efficiencyScore == null) missing.push('sleep efficiency');
  missing.push('sleep stress from continuous sensor data');
  const state: RecoveryScoreState = actualSleepMinutes == null ? 'unscorable' : nights.length < 4 ? 'calibrating' : 'scored';
  const reasons: string[] = [];
  if (actualSleepMinutes != null) reasons.push(`นอน ${formatSleepMinutesThai(actualSleepMinutes)} จากที่ต้องการประมาณ ${formatSleepMinutesThai(sleepNeedMinutes)}`);
  if (debtMinutes > 0) reasons.push(`Sleep debt เพิ่มความต้องการนอน ${formatSleepMinutesThai(debtMinutes)}`);
  if (strainNeed > 0) reasons.push(`Strain วันนี้เพิ่มความต้องการนอน ${formatSleepMinutesThai(strainNeed)}`);
  if (consistencyScore != null) reasons.push(`ความสม่ำเสมอเวลาเข้านอนและตื่น ${consistencyScore}%`);
  if (efficiencyScore != null) reasons.push(`Sleep efficiency ${efficiencyScore}%`);
  const typicalWakeMinutes = median(wakeTimes);
  const targetSleepMinutes = typicalWakeMinutes == null ? null : typicalWakeMinutes - sleepNeedMinutes;
  return {
    score,
    state,
    label: score >= 85 ? 'เหมาะสม' : score >= 70 ? 'เพียงพอ' : 'ควรปรับปรุง',
    summary: actualSleepMinutes == null ? 'ยังไม่มีข้อมูลการนอนล่าสุด' : `นอนได้ ${sufficiencyScore ?? 0}% ของ Sleep Need`,
    estimated: true,
    sleepNeedMinutes,
    actualSleepMinutes,
    sufficiencyScore,
    consistencyScore,
    qualityScore,
    efficiencyScore,
    sleepDebtMinutes: debtMinutes,
    targetWakeTime: typicalWakeMinutes == null ? null : formatClock(typicalWakeMinutes),
    targetSleepTime: targetSleepMinutes == null ? null : formatClock(targetSleepMinutes),
    recommendedInBedTime: targetSleepMinutes == null ? null : formatClock(targetSleepMinutes - 20),
    reasons,
    missing,
  };
}

function workoutEffort(workout: TodayCompletedWorkoutSummary, restingHR: number, maxHR: number): number {
  const duration = workout.durationMin ?? 0;
  if (!duration) return 0;
  if (workout.kind === 'strength') return duration * 0.55;
  if (workout.kind === 'walk') return duration * 0.22;
  const avgHR = workout.avgHR;
  if (avgHR == null || maxHR <= restingHR) return duration * (workout.kind === 'run' || workout.kind === 'race' ? 0.48 : 0.35);
  const reserve = clamp((avgHR - restingHR) / (maxHR - restingHR), 0.2, 1.05);
  return duration * Math.pow(reserve, 1.7);
}

function buildStrain(context: CoachContext): StrainSummary {
  const latestRHR = context.sleep7d[0]?.restingHR ?? 60;
  const profileMaxHR = Number(context.profile?.maxHr ?? context.profile?.max_hr);
  const maxHR = Number.isFinite(profileMaxHR) && profileMaxHR > latestRHR ? profileMaxHR : 190;
  const effort = context.todayWorkouts.reduce((sum, workout) => sum + workoutEffort(workout, latestRHR, maxHR), 0);
  const score = Math.round(clamp(21 * (1 - Math.exp(-effort / 75)), 0, 21) * 10) / 10;
  const level: StrainSummary['level'] = score >= 18 ? 'all_out' : score >= 14 ? 'high' : score >= 10 ? 'moderate' : 'light';
  const label = level === 'all_out' ? 'สุดกำลัง' : level === 'high' ? 'สูง' : level === 'moderate' ? 'ปานกลาง' : 'เบา';
  const reasons = context.todayWorkouts.map((workout) => `${workout.label} ${workout.durationMin ?? 0} นาที${workout.avgHR ? ` · HR เฉลี่ย ${workout.avgHR}` : ''}`);
  if (!reasons.length) reasons.push('วันนี้ยังไม่มี workout ที่บันทึกไว้');
  return {
    score,
    scaleMax: 21,
    level,
    label,
    summary: score < 10 ? 'ภาระวันนี้ยังเบา' : score < 14 ? 'ภาระวันนี้ช่วยรักษาความฟิต' : score < 18 ? 'ภาระสูง ต้องให้ความสำคัญกับการฟื้นตัว' : 'ภาระหนักมากและฟื้นตัวยาก',
    estimated: true,
    reasons,
    weeklyTrend: { sessions: context.totalSessions, distanceKm: Math.round(context.totalRunKm * 10) / 10 },
  };
}

function buildFuelInsight(context: CoachContext): FuelInsight {
  const mealCount = context.mealsToday.length;
  const carbs = context.nutritionBalanceToday?.carbStatus ?? null;
  const protein = context.nutritionBalanceToday?.proteinStatus ?? null;
  const reasons: string[] = [];
  if (mealCount) reasons.push(`บันทึกอาหารแล้ว ${mealCount} มื้อ`);
  if (carbs) reasons.push(`สถานะคาร์บ: ${carbs}`);
  if (protein) reasons.push(`สถานะโปรตีน: ${protein}`);
  if (!mealCount) return { status: 'unknown', label: 'ข้อมูลไม่พอ', summary: 'ยังไม่มีบันทึกอาหารวันนี้', reasons };
  if (carbs === 'low' && protein === 'low') return { status: 'low', label: 'ควรเติมพลังงาน', summary: 'คาร์บและโปรตีนยังต่ำกว่าเป้าหมาย', reasons };
  if (carbs === 'low' || protein === 'low') return { status: 'top_up', label: 'ควรเติมอีกเล็กน้อย', summary: carbs === 'low' ? 'เติมคาร์บก่อนรับโหลดเพิ่ม' : 'เติมโปรตีนเพื่อช่วยฟื้นตัว', reasons };
  return { status: 'ready', label: 'รองรับการฟื้นตัว', summary: 'สารอาหารที่บันทึกไว้เพียงพอกับแผนวันนี้', reasons };
}

function buildRecovery(context: CoachContext, sleep: SleepPerformanceSummary, overrides?: RecoverySystemOverrides): RecoveryAxis {
  const nights = context.sleepBaseline30d;
  const latest = nights[0] ?? null;
  const baseline = nights.slice(1);
  const hrvBaseline = median(baseline.map((night) => night.hrv).filter((value): value is number => value != null));
  const rhrBaseline = median(baseline.map((night) => night.restingHR).filter((value): value is number => value != null));
  const respiratoryBaseline = median(baseline.map((night) => night.respiratoryRate).filter((value): value is number => value != null));
  const reasons: string[] = [];
  const missing: string[] = [];
  let score = sleep.score || 50;
  let signalWeight = 0;
  let signalTotal = 0;
  if (latest?.hrv != null && hrvBaseline != null && hrvBaseline > 0) {
    const delta = (latest.hrv - hrvBaseline) / hrvBaseline;
    const hrvScore = clamp(65 + delta * 180);
    signalTotal += hrvScore * 0.4;
    signalWeight += 0.4;
    reasons.push(`HRV ${latest.hrv} ms เทียบ baseline ${round(hrvBaseline)} ms (${delta >= 0 ? '+' : ''}${round(delta * 100)}%)`);
  } else missing.push('HRV baseline ส่วนตัว');
  if (latest?.restingHR != null && rhrBaseline != null && rhrBaseline > 0) {
    const delta = (latest.restingHR - rhrBaseline) / rhrBaseline;
    const rhrScore = clamp(65 - delta * 180);
    signalTotal += rhrScore * 0.25;
    signalWeight += 0.25;
    reasons.push(`RHR ${latest.restingHR} bpm เทียบ baseline ${round(rhrBaseline)} bpm (${delta >= 0 ? '+' : ''}${round(delta * 100)}%)`);
  } else missing.push('RHR baseline ส่วนตัว');
  if (latest?.respiratoryRate != null && respiratoryBaseline != null && respiratoryBaseline > 0) {
    const delta = (latest.respiratoryRate - respiratoryBaseline) / respiratoryBaseline;
    const respiratoryScore = clamp(70 - Math.abs(delta) * 300);
    signalTotal += respiratoryScore * 0.15;
    signalWeight += 0.15;
    reasons.push(`Respiratory rate ${latest.respiratoryRate}/min versus baseline ${respiratoryBaseline.toFixed(1)}/min`);
  } else missing.push('respiratory-rate baseline');
  if (sleep.state !== 'unscorable') {
    signalTotal += sleep.score * 0.2;
    signalWeight += 0.2;
    reasons.push(`Sleep Performance ${sleep.score}%`);
  } else missing.push('Sleep Performance');
  if (signalWeight > 0) score = round(signalTotal / signalWeight);
  const activePain = overrides?.injuryFlag ?? context.activePain;
  if (overrides?.muscleSoreness === 'sore') score -= 10;
  else if (overrides?.muscleSoreness === 'light') score -= 4;
  if (context.activeSick) {
    score = Math.min(score, context.sickRiskLevel === 'hard_stop' ? 25 : 45);
    reasons.push('มีบันทึกอาการป่วย จึงจำกัดคะแนนเพื่อความปลอดภัย');
  }
  if (activePain) {
    const painLevel = context.latestPain?.painLevel ?? 4;
    score = Math.min(score, painLevel >= 7 || Boolean(context.latestPain?.redFlags.length) ? 25 : painLevel >= 4 ? 33 : 45);
    reasons.push(`มีอาการเจ็บระดับ ${painLevel}/10 จึงใช้ safety cap`);
  }
  score = round(clamp(score));
  return {
    key: 'recovery',
    score,
    status: recoveryStatus(score),
    label: recoveryLabel(score),
    summary: score >= 67 ? 'ร่างกายพร้อมรับ Strain สูงขึ้น' : score >= 34 ? 'พร้อมรับ Strain ระดับปานกลาง' : 'ควรลด Strain และเน้นฟื้นตัว',
    reasons,
    missing: missing.length ? missing : undefined,
  };
}

export function buildRunMateRecoverySystem(context: CoachContext | null, overrides?: RecoverySystemOverrides): RunMateRecoverySystem {
  if (!context) {
    const recovery: RecoveryAxis = { key: 'recovery', score: 0, status: 'low', label: 'ยังคำนวณไม่ได้', summary: 'ต้องมีข้อมูลการนอนล่าสุดก่อน', reasons: [], missing: ['ข้อมูลการนอน'] };
    const sleep: SleepPerformanceSummary = { score: 0, state: 'unscorable', label: 'ยังคำนวณไม่ได้', summary: 'ยังไม่มีข้อมูลการนอน', estimated: true, sleepNeedMinutes: 480, actualSleepMinutes: null, sufficiencyScore: null, consistencyScore: null, qualityScore: null, efficiencyScore: null, sleepDebtMinutes: 0, targetWakeTime: null, targetSleepTime: null, recommendedInBedTime: null, reasons: [], missing: ['ข้อมูลการนอน'] };
    const strain: StrainSummary = { score: 0, scaleMax: 21, level: 'light', label: 'เบา', summary: 'ยังไม่มี activity วันนี้', estimated: true, reasons: [], weeklyTrend: { sessions: 0, distanceKm: 0 } };
    const fuel: FuelInsight = { status: 'unknown', label: 'ข้อมูลไม่พอ', summary: 'ยังไม่มีข้อมูลอาหารวันนี้', reasons: [] };
    return assemble(null, recovery, strain, sleep, fuel, 'unscorable', { status: 'missing', latestSleepDate: null, ageDays: null });
  }
  const strain = buildStrain(context);
  const sleep = buildSleepPerformance(context, strain.score);
  const recovery = buildRecovery(context, sleep, overrides);
  const fuel = buildFuelInsight(context);
  const latestSleepDate = context.sleepBaseline30d[0]?.date ?? null;
  const ageDays = latestSleepDate == null ? null : Math.max(0, Math.round((Date.parse(`${context.todayDate}T00:00:00Z`) - Date.parse(`${latestSleepDate}T00:00:00Z`)) / 86400000));
  const freshness: RecoveryDataFreshness = latestSleepDate == null
    ? { status: 'missing', latestSleepDate: null, ageDays: null }
    : latestSleepDate === context.todayDate
      ? { status: 'today', latestSleepDate, ageDays: 0 }
      : { status: 'stale', latestSleepDate, ageDays };
  const scoreState: RecoveryScoreState = freshness.status === 'stale'
    ? 'stale'
    : sleep.state === 'unscorable' || recovery.reasons.length === 0
      ? 'unscorable'
      : context.sleepBaseline30d.length < 4 ? 'calibrating' : 'scored';
  return assemble(context, recovery, strain, sleep, fuel, scoreState, freshness);
}

function assemble(context: CoachContext | null, recovery: RecoveryAxis, strain: StrainSummary, sleep: SleepPerformanceSummary, fuel: FuelInsight, scoreState: RecoveryScoreState, dataFreshness: RecoveryDataFreshness): RunMateRecoverySystem {
  const activePain = context?.activePain ?? false;
  const strainAsPercent = round(strain.score / 21 * 100);
  const loadAxis: RecoveryAxis = { key: 'load', score: strainAsPercent, status: strain.score >= 14 ? 'high' : strain.score >= 10 ? 'moderate' : 'low', label: strain.label, summary: `${strain.score.toFixed(1)}/21 · ${strain.summary}`, reasons: strain.reasons };
  const sleepAxis: RecoveryAxis = { key: 'sleep', score: sleep.score, status: sleep.score >= 85 ? 'high' : sleep.score >= 70 ? 'good' : sleep.score >= 50 ? 'moderate' : 'low', label: sleep.label, summary: sleep.summary, reasons: sleep.reasons, missing: sleep.missing };
  const fuelScore = fuel.status === 'ready' ? 100 : fuel.status === 'top_up' ? 60 : fuel.status === 'low' ? 30 : 0;
  const fuelAxis: RecoveryAxis = { key: 'fuel', score: fuelScore, status: fuelScore >= 80 ? 'high' : fuelScore >= 50 ? 'moderate' : 'low', label: fuel.label, summary: fuel.summary, reasons: fuel.reasons };
  const display = getOverallDisplayStatus(recovery.score, recovery.score, strainAsPercent, sleep.score, fuelScore, activePain, context?.recentPainHistory ?? false);
  const coachingState: RunMateRecoverySystem['coachingState'] = recovery.score >= 67 ? 'push' : recovery.score >= 34 ? (strain.score >= 14 ? 'easy' : 'maintain') : 'recover';
  const recommendedIntensity: RunMateRecoverySystem['recommendedIntensity'] = coachingState === 'push' ? 'hard' : coachingState === 'maintain' ? 'moderate' : coachingState === 'easy' ? 'easy' : activePain ? 'rest' : 'walk';
  const guardrails: string[] = [];
  if (scoreState === 'calibrating') guardrails.push('ระบบกำลังเรียนรู้ baseline ส่วนตัว ใช้คะแนนวันนี้เป็นแนวโน้มเบื้องต้น');
  if (scoreState === 'unscorable') guardrails.push('ข้อมูล physiological ยังไม่พอสำหรับ Recovery score ที่น่าเชื่อถือ');
  if (scoreState === 'stale') guardrails.push(`ข้อมูลการนอนล่าสุดเป็นของ ${dataFreshness.latestSleepDate ?? 'วันก่อน'} ห้ามใช้เป็น Today’s Recovery`);
  if (activePain) guardrails.push('มีอาการเจ็บอยู่ ให้ safety cap สำคัญกว่าคะแนนอื่น');
  if (strain.score >= 14 && recovery.score < 67) guardrails.push('Strain สูงกว่าความพร้อมวันนี้ ควรหยุดเพิ่มโหลด');
  if (sleep.score < 70 && sleep.state !== 'unscorable') guardrails.push(`คืนนี้ควรนอนประมาณ ${formatSleepMinutesThai(sleep.sleepNeedMinutes)}`);
  if (!guardrails.length) guardrails.push(recovery.score >= 67 ? 'Recovery อยู่ในโซนเขียว สามารถรับโหลดตามแผนได้' : 'รักษา Strain ระดับปานกลางและติดตามสัญญาณร่างกาย');
  return {
    model: 'whoop_style_v1', scoreState, dataFreshness, overallScore: recovery.score, overallLabel: display.label, overallDisplayStatus: display,
    coachingState,
    headline: recovery.summary,
    recovery, strain, sleepPerformance: sleep, fuelInsight: fuel,
    axes: { recovery, load: loadAxis, sleep: sleepAxis, fuel: fuelAxis },
    guardrails, recommendedIntensity,
    sourceCoverage: { used: recovery.reasons, missing: [...(recovery.missing ?? []), ...sleep.missing] },
  };
}

export function formatAxisScore(score: number): string { return `${round(score)}/100`; }

export function getRecoveryAxisLabel(axisKey: RecoveryAxis['key'], score: number): string {
  if (axisKey === 'load') return score >= 86 ? 'สุดกำลัง' : score >= 67 ? 'สูง' : score >= 48 ? 'ปานกลาง' : 'เบา';
  if (axisKey === 'recovery') return recoveryLabel(score);
  if (axisKey === 'sleep') return score >= 85 ? 'เหมาะสม' : score >= 70 ? 'เพียงพอ' : 'ควรปรับปรุง';
  return score >= 80 ? 'พร้อม' : score >= 50 ? 'ควรเติม' : 'ข้อมูลน้อย';
}

export function getAxisTone(axisKey: RecoveryAxis['key'], score: number): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (axisKey === 'load') return score >= 67 ? 'warning' : score >= 48 ? 'info' : 'neutral';
  if (score >= 67) return 'success';
  if (score >= 34) return 'warning';
  return 'danger';
}

export type AxisCoachingToneContext = { hasActivePain?: boolean; recoveryScore?: number; sleepScore?: number; loadScore?: number };
export function getRecoveryAxisCoachingTone(axisKey: RecoveryAxis['key'], score: number, ctx?: AxisCoachingToneContext): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  if (ctx?.hasActivePain && axisKey === 'recovery') return 'danger';
  return getAxisTone(axisKey, score);
}

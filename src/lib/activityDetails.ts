import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';

export function buildMealDetail(item: LocalHistoryItem) {
  const data = record(item.data);
  const nutrition = record(data.nutrition);
  const trainingFit = record(data.trainingFit);
  const coach = record(data.coach);
  const foods = Array.isArray(data.detectedFoods) ? data.detectedFoods.map((value) => {
    const food = record(value);
    return { name: string(food.name) ?? 'Food Item', portion: string(food.portionEstimate), quantity: typeof food.quantity === 'number' ? food.quantity : null, unit: string(food.unit) };
  }) : [];
  const metrics = compact([
    ['Calories', unit(nutrition.caloriesKcal, 'kcal')], ['Protein', unit(nutrition.proteinG, 'g')], ['Carbs', unit(nutrition.carbsG, 'g')],
    ['Fat', unit(nutrition.fatG, 'g')], ['Fiber', unit(nutrition.fiberG, 'g')],
  ]);
  const guidance = compact([
    ['Training Fit', string(trainingFit.coachNote) ?? string(extract(data, 'extracted', 'trainingFit'))],
    ['Hydration', string(trainingFit.hydrationNote) ?? string(extract(data, 'extracted', 'hydrationSuggestion'))],
    ['Coach Note', string(data.coachNote) ?? string(coach.suggestion) ?? string(coach.aiSummary)],
  ]);
  return {
    title: titleCase(string(data.mealType) ?? string(data.mealSlot) ?? 'Meal'), date: displayDate(item), foods, metrics, guidance,
    source: source(item), note: string(data.note) ?? string(data.originalMealText),
  };
}

export function buildHealthDetail(item: LocalHistoryItem) {
  const data = record(item.data);
  if (item.type === 'pain') {
    const location = string(data.painLocation) ?? 'Pain';
    return {
      kind: 'Pain', tone: 'pain', title: `${titleCase(location)} Pain`, date: displayDate(item), status: painStatus(data),
      metrics: compact([['Pain Level', unit(data.painLevel, '/10')], ['Side', titleCase(string(data.painSide) ?? '')], ['Started', titleCase(string(data.startedWhen) ?? '')], ['Training Impact', titleCase(string(data.trainingImpact) ?? '')], ['Status', titleCase(string(data.status) ?? (data.resolved === true ? 'resolved' : 'active'))]]),
      tags: [...strings(data.painType), ...strings(data.painfulWhen)].map(titleCase),
      alerts: [...strings(data.redFlags), data.swellingOrRedness === 'yes' ? 'Swelling Or Redness' : null, data.canBearWeight === 'no' ? 'Cannot Bear Weight' : null].filter((value): value is string => Boolean(value)),
      guidance: string(data.coachAdvice), note: string(data.notes), source: source(item),
    };
  }
  const symptoms = strings(data.symptoms).map(titleCase);
  return {
    kind: 'Sick', tone: 'sick', title: 'Sick Check-In', date: displayDate(item), status: sickStatus(data),
    metrics: compact([['Severity', titleCase(string(data.severity) ?? '')], ['Health Status', titleCase(string(data.healthStatus) ?? '')], ['Training Decision', titleCase(string(data.trainingDecision) ?? '')]]),
    tags: symptoms,
    alerts: [data.fever === true ? 'Fever' : null, data.chestSymptoms === true ? 'Chest Symptoms' : null, data.giSymptoms === true ? 'GI Symptoms' : null, data.heavyFatigue === true ? 'Heavy Fatigue' : null].filter((value): value is string => Boolean(value)),
    guidance: trainingDecisionCopy(string(data.trainingDecision)), note: string(data.note), source: source(item),
  };
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function extract(value: Record<string, unknown>, parent: string, child: string): unknown { return record(value[parent])[child]; }
function string(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []; }
function number(value: unknown): string | null { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10}` : null; }
function unit(value: unknown, suffix: string): string | null { const result = number(value); return result ? `${result} ${suffix}` : null; }
function titleCase(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function compact(values: Array<[string, string | null]>): Array<{ label: string; value: string }> { return values.filter((value): value is [string, string] => Boolean(value[1])).map(([label, value]) => ({ label, value })); }
function source(item: LocalHistoryItem): string { return item.source?.provider ? titleCase(item.source.provider) : 'RunMate'; }
function displayDate(item: LocalHistoryItem): string { return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${getHistoryItemDateKey(item)}T12:00:00`)); }
function trainingDecisionCopy(value: string | null): string | null { return value === 'rest_only' ? 'Rest and avoid training until symptoms improve.' : value === 'light_movement_only' ? 'Keep activity limited to light movement while recovering.' : value === 'normal_training_allowed' ? 'Normal training is allowed if symptoms remain stable.' : null; }
function painStatus(data: Record<string, unknown>): string {
  if (data.resolved === true || string(data.status) === 'resolved') return 'Resolved';
  return titleCase(string(data.recoveryStatus) ?? string(data.status) ?? string(data.riskLevel) ?? 'Recorded');
}
function sickStatus(data: Record<string, unknown>): string {
  return titleCase(string(data.healthStatus) ?? string(data.riskLevel) ?? string(data.severity) ?? 'Recorded');
}

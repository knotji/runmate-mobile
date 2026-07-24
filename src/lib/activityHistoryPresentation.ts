import { barbellOutline, bicycleOutline, bodyOutline, fastFoodOutline, fitnessOutline, heartOutline, moonOutline, walkOutline, waterOutline } from 'ionicons/icons';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { MergedWorkoutItem } from '@/lib/workoutDedupe';

export function describeHistoryItem(item: LocalHistoryItem): { label: string; title: string; detail: string; icon: string; tone: string } {
  const data = asRecord(item.data); const extracted = asRecord(data.extracted);
  if (item.type === 'sleep') return { label: 'Sleep', title: text(extracted.sleepDuration) ?? minutesText(extracted.actualSleepDurationMinutes) ?? 'Sleep Record', detail: 'Sleep Session Recorded', icon: moonOutline, tone: 'sleep' };
  if (item.type === 'workout' || item.type === 'strength') {
    const rawKind = (text(extracted.workoutKind) ?? (item.type === 'strength' ? 'strength_training' : 'workout')).toLowerCase();
    const kind = titleFromKey(rawKind);
    const details = [numberUnit(extracted.distanceKm, 'km'), text(extracted.duration), numberUnit(extracted.avgHR, 'bpm')].filter(Boolean).join(' · ');
    let icon = fitnessOutline;
    if (item.type === 'strength' || rawKind.includes('strength') || rawKind.includes('weight')) icon = barbellOutline;
    else if (rawKind.includes('cycle') || rawKind.includes('bike') || rawKind.includes('biking')) icon = bicycleOutline;
    else if (rawKind.includes('swim')) icon = waterOutline;
    else if (rawKind.includes('walk') || rawKind.includes('hike')) icon = walkOutline;

    return { label: item.type === 'strength' ? 'Strength' : 'Workout', title: kind, detail: details || 'Training session recorded', icon, tone: 'workout' };
  }
  if (item.type === 'meal') {
    const foods = Array.isArray(data.detectedFoods) ? data.detectedFoods.map((food) => text(asRecord(food).name)).filter(Boolean).slice(0, 2).join(', ') : null;
    return { label: 'Nutrition', title: foods || titleFromKey(text(data.mealType) ?? 'Meal'), detail: numberUnit(asRecord(data.nutrition).caloriesKcal, 'kcal') ?? 'Meal recorded', icon: fastFoodOutline, tone: 'meal' };
  }
  if (item.type === 'pain') return { label: 'Pain', title: text(data.painLocation) ?? 'Pain Check-In', detail: numberUnit(data.painLevel, '/10') ?? 'Health record', icon: heartOutline, tone: 'health' };
  if (item.type === 'sick') return { label: 'Health', title: 'Sick Check-In', detail: arrayText(data.symptoms) ?? 'Symptoms recorded', icon: heartOutline, tone: 'health' };
  if (item.type === 'body') return { label: 'Body', title: numberUnit(extracted.weightKg, 'kg') ?? 'Body Composition', detail: numberUnit(extracted.bodyFatPercent, '% body fat') ?? 'Body record', icon: bodyOutline, tone: 'body' };
  return { label: titleFromKey(item.type), title: 'RunMate Record', detail: 'Health activity recorded', icon: fitnessOutline, tone: 'other' };
}

export function activitySourceLabel(item: LocalHistoryItem): string {
  const sources = (item as MergedWorkoutItem).reconciledSources;
  return sources?.length ? sources.join(' + ') : titleFromKey((item.source?.provider ?? 'manual').replace('_health', ' Health').replace('_connect', ' Connect'));
}

function asRecord(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function numberUnit(value: unknown, unit: string): string | null { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10} ${unit}` : null; }
function minutesText(value: unknown): string | null { return typeof value === 'number' ? `${Math.floor(value / 60)}h ${Math.round(value % 60)}m` : null; }
function arrayText(value: unknown): string | null { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(titleFromKey).join(', ') || null : null; }
function titleFromKey(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

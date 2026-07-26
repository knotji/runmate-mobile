import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { parseGpx, saveGpxRoute, type StoredGpxRoute } from '@/lib/gpxRoute';
import { saveCloudWorkoutRoute } from '@/lib/cloudWorkoutRoute';
import type { LocalHistoryItem } from '@/lib/localHistory';

type SharedGpxPayload = { available: boolean; fileName?: string; text?: string };

interface SharedGpxNativePlugin {
  getPending(): Promise<SharedGpxPayload>;
  addListener(eventName: 'sharedGpxAvailable', listener: () => void): Promise<PluginListenerHandle>;
}

const SharedGpx = registerPlugin<SharedGpxNativePlugin>('SharedGpx');

export function sharedGpxSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function consumeSharedGpx(): Promise<{ workoutId: string } | null> {
  if (!sharedGpxSupported()) return null;
  const payload = await SharedGpx.getPending();
  if (!payload.available || !payload.text) return null;
  const route = parseGpx(payload.text, payload.fileName ?? 'Samsung Health Route.gpx');
  const history = await loadHistoryItems(['workout']);
  if (!history.ok) throw new Error(history.error);
  const match = matchRouteToWorkout(route, history.items);
  if (!match) throw new Error('No Outdoor Run within 10 minutes of this GPX route was found.');
  const saved = await saveCloudWorkoutRoute(match.id, route);
  if (!saved.ok) throw new Error(saved.error);
  saveGpxRoute(match.id, route);
  return { workoutId: match.id };
}

export function onSharedGpxAvailable(listener: () => void): Promise<PluginListenerHandle> {
  return SharedGpx.addListener('sharedGpxAvailable', listener);
}

export function matchRouteToWorkout(route: StoredGpxRoute, items: LocalHistoryItem[]): LocalHistoryItem | null {
  const routeStart = route.startTime ? Date.parse(route.startTime) : Number.NaN;
  if (!Number.isFinite(routeStart)) return null;
  return dedupeWorkoutItems(items)
    .map((item) => ({ item, difference: Math.abs(workoutStart(item) - routeStart) }))
    .filter(({ item, difference }) => isOutdoorRun(item) && Number.isFinite(difference) && difference <= 10 * 60_000)
    .sort((a, b) => a.difference - b.difference)[0]?.item ?? null;
}

function workoutStart(item: LocalHistoryItem): number {
  const data = record(item.data);
  const extracted = record(data.extracted);
  const value = text(data.workoutStartTime) ?? text(extracted.workoutStartTime) ?? text(extracted.startDate) ?? item.recordedAt ?? item.createdAt;
  return Date.parse(value);
}

function isOutdoorRun(item: LocalHistoryItem): boolean {
  return text(record(record(item.data).extracted).workoutKind)?.toLowerCase() === 'outdoor_run';
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }

import { registerPlugin } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { patchHistoryItemData } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';

/**
 * Optional, opt-in exception to RunMate's otherwise read-only Health Connect
 * design: with this on, each saved meal's calories and macros are written to
 * Health Connect as a Nutrition record so other Health Connect apps can see
 * meals logged in RunMate.
 *
 * Authorization is still requested/checked through `@capgo/capacitor-health`
 * (its `dietaryEnergyConsumed` data type maps to the same
 * `android.permission.health.WRITE_NUTRITION` permission Health Connect grants
 * for the whole `NutritionRecord` type, not per nutrient — so no separate
 * permission is needed for protein/carbs/fat). The actual write goes through
 * a small custom native plugin (`MealNutritionPlugin.kt`) instead, because
 * `@capgo/capacitor-health`'s own `saveSample` API takes one scalar value per
 * call and has no macro fields — that limitation is in its API surface, not
 * in Health Connect or the permission itself.
 */

interface MealNutritionNativePlugin {
  saveMealNutrition(options: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    /** Free-text label shown in Health Connect apps (e.g. Samsung Health) — the detected food names, joined. */
    name: string | null;
    /** One of Health Connect's `MealType` string constants ('breakfast' | 'lunch' | 'dinner' | 'snack') — RunMate's own meal-type values already match. */
    mealType: string | null;
    startDate: string;
    endDate: string;
  }): Promise<{ recordId: string }>;
  deleteMealNutrition(options: { recordId: string }): Promise<void>;
}

const MAX_NUTRITION_RECORD_NAME_LENGTH = 200;

const MealNutrition = registerPlugin<MealNutritionNativePlugin>('MealNutrition');

const ENABLED_KEY = 'runmate:nutrition-sync-enabled:v1';

export function loadNutritionSyncEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === 'true'; }
  catch { return false; }
}

export function saveNutritionSyncEnabled(enabled: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false'); }
  catch { /* localStorage unavailable — nothing to persist */ }
}

export type NutritionSyncAuthorization = 'granted' | 'denied' | 'unavailable';

async function resolveAuthorization(status: { writeAuthorized: string[] } | null, available: boolean): Promise<NutritionSyncAuthorization> {
  if (!available) return 'unavailable';
  return status?.writeAuthorized.includes('dietaryEnergyConsumed') ? 'granted' : 'denied';
}

/** Prompts the user for Health Connect write access. Call only when the user explicitly turns the toggle on. */
export async function requestNutritionSyncAuthorization(): Promise<NutritionSyncAuthorization> {
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return 'unavailable';
    const status = await Health.requestAuthorization({ write: ['dietaryEnergyConsumed'] });
    return resolveAuthorization(status, true);
  } catch (error) {
    console.warn('[nutritionSync] requestAuthorization failed', error);
    return 'unavailable';
  }
}

/** Checks current authorization without prompting the user. */
export async function checkNutritionSyncAuthorization(): Promise<NutritionSyncAuthorization> {
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return 'unavailable';
    const status = await Health.checkAuthorization({ write: ['dietaryEnergyConsumed'] });
    return resolveAuthorization(status, true);
  } catch (error) {
    console.warn('[nutritionSync] checkAuthorization failed', error);
    return 'unavailable';
  }
}

export type MealNutritionValues = {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

function extractMealNutrition(data: unknown): MealNutritionValues {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const nutrition = record.nutrition && typeof record.nutrition === 'object' ? record.nutrition as Record<string, unknown> : {};
  const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
  return {
    caloriesKcal: num(nutrition.caloriesKcal),
    proteinG: num(nutrition.proteinG),
    carbsG: num(nutrition.carbsG),
    fatG: num(nutrition.fatG),
  };
}

/**
 * Detected-food names and meal type (breakfast/lunch/dinner/snack) are already on every
 * saved meal — RunMate's own `mealType`/`mealSlot` string values are exactly Health
 * Connect's `MealType` string constants, so they pass straight through to the native
 * plugin without a lookup table on either side.
 */
function extractMealLabel(data: unknown): { name: string | null; mealType: string | null } {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const foods = Array.isArray(record.detectedFoods) ? record.detectedFoods : [];
  const foodNames = foods
    .map((food) => food && typeof food === 'object' ? (food as Record<string, unknown>).name : null)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
  const name = foodNames.length ? foodNames.join(', ').slice(0, MAX_NUTRITION_RECORD_NAME_LENGTH) : null;
  const mealType = typeof record.mealType === 'string' && record.mealType.trim() ? record.mealType : null;
  return { name, mealType };
}

function readHealthConnectRecordId(data: unknown): string | null {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  return typeof record.healthConnectRecordId === 'string' ? record.healthConnectRecordId : null;
}

const LAST_ATTEMPT_KEY = 'runmate:nutrition-sync-last-attempt:v1';

export type NutritionSyncAttempt = {
  at: string;
  outcome: 'success' | 'skipped_no_calories' | 'skipped_not_authorized' | 'error';
  detail?: string;
};

/**
 * The sync call below is deliberately fire-and-forget from the caller's point of view
 * (it must never block or fail the meal save), which means its outcome is otherwise
 * invisible. This records the last attempt so `NutritionSyncSettings` can show the user
 * — and RunMate can debug — what actually happened, without needing device logs.
 */
export function loadLastNutritionSyncAttempt(): NutritionSyncAttempt | null {
  try {
    const raw = localStorage.getItem(LAST_ATTEMPT_KEY);
    return raw ? JSON.parse(raw) as NutritionSyncAttempt : null;
  } catch { return null; }
}

function recordAttempt(attempt: NutritionSyncAttempt): void {
  try { localStorage.setItem(LAST_ATTEMPT_KEY, JSON.stringify(attempt)); }
  catch { /* localStorage unavailable — nothing to persist */ }
}

/**
 * Capacitor plugin rejections don't reliably arrive as an `Error` with a populated
 * `.message` — some native rejections marshal into a plain object, and Capacitor's own
 * wrapper occasionally produces an empty `message`. Pull whatever identifying detail is
 * actually present (message, then code/name, then a JSON dump) so the diagnostic below
 * is never a bare, unexplained "Failed".
 */
function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === 'string' && record.message ? record.message : null;
    const code = typeof record.code === 'string' && record.code ? record.code : null;
    const name = typeof record.name === 'string' && record.name ? record.name : null;
    const parts = [message, code, name].filter((part): part is string => part != null);
    if (parts.length) return parts.join(' · ');
    try { return JSON.stringify(error); } catch { /* fall through */ }
  }
  const stringified = String(error);
  return stringified && stringified !== '[object Object]' ? stringified : 'Unknown error (no message from the native plugin)';
}

function hasAnyNutritionValue(nutrition: MealNutritionValues): boolean {
  return [nutrition.caloriesKcal, nutrition.proteinG, nutrition.carbsG, nutrition.fatG]
    .some((value) => value != null && Number.isFinite(value) && value > 0);
}

/**
 * Best-effort, one-way write of a saved meal's calories and macros to Health Connect.
 * Never blocks or fails the meal save itself — every failure path here is swallowed and
 * logged, not thrown, since this is a side effect of saving a meal, not the save
 * operation itself. On success, the returned Health Connect record ID is patched onto
 * the meal's own history item (`healthConnectRecordId`) so a later delete can clean up
 * the same record — see `deleteMealNutritionRecord`.
 */
export async function syncMealNutritionToHealthConnect(item: LocalHistoryItem): Promise<void> {
  if (!loadNutritionSyncEnabled()) return;
  const at = new Date().toISOString();
  const nutrition = extractMealNutrition(item.data);
  if (!hasAnyNutritionValue(nutrition)) {
    recordAttempt({ at, outcome: 'skipped_no_calories' });
    return;
  }
  try {
    const authorization = await checkNutritionSyncAuthorization();
    if (authorization !== 'granted') {
      recordAttempt({ at, outcome: 'skipped_not_authorized', detail: authorization });
      return;
    }
    // The native plugin parses startDate/endDate with Kotlin's `Instant.parse()`, which only
    // accepts a 'Z'-suffixed UTC string — not `+HH:MM`-offset ISO strings like RunMate's
    // `dateKeyToRecordedAt()` produces (e.g. "2026-08-14T12:00:00+07:00"). Passing the offset
    // form directly throws DateTimeParseException on the native side for every write.
    //
    // `dateKeyToRecordedAt()` is a nominal "sometime that day" placeholder fixed at noon
    // Bangkok time, not the meal's real logged time. For a meal logged today before noon
    // local time, that placeholder is still later than the actual current moment, and
    // Health Connect rejects any record whose start (and, empirically, end) time is in
    // the future. Clamp to now so a same-day meal always resolves to "now" instead of a
    // not-yet-arrived noon, then build the required start-before-end interval by placing
    // the 1-minute pad *before* that clamped instant, never after — so neither endpoint
    // can end up in the future even by the time the native write actually executes.
    const recordedAt = item.recordedAt ?? item.createdAt;
    const clampedInstant = new Date(Math.min(new Date(recordedAt).getTime(), Date.now()));
    const endInstant = clampedInstant;
    // Health Connect's NutritionRecord is an interval record and requires endTime to be
    // strictly after startTime — an equal start/end throws "startTime must be before
    // endTime" on the native side. A meal is really a point-in-time event, so a nominal
    // 1-minute interval is enough to satisfy the constraint without implying a duration.
    const startInstant = new Date(endInstant.getTime() - 60_000);
    const { name, mealType } = extractMealLabel(item.data);
    const result = await MealNutrition.saveMealNutrition({
      ...nutrition,
      name,
      mealType,
      startDate: startInstant.toISOString(),
      endDate: endInstant.toISOString(),
    });
    const patchResult = await patchHistoryItemData(item, { healthConnectRecordId: result.recordId });
    if (!patchResult.ok) {
      // The Health Connect write itself succeeded; only the local "so we can delete this
      // later" bookkeeping failed. Not fatal to this sync, but worth a loud warning since
      // it silently reintroduces the orphaned-record problem this bookkeeping exists to fix.
      console.warn('[nutritionSync] Wrote to Health Connect but failed to save the record ID for future deletion', patchResult.error);
    }
    const parts = [
      nutrition.caloriesKcal != null ? `${nutrition.caloriesKcal} kcal` : null,
      nutrition.proteinG != null ? `${nutrition.proteinG}g protein` : null,
      nutrition.carbsG != null ? `${nutrition.carbsG}g carbs` : null,
      nutrition.fatG != null ? `${nutrition.fatG}g fat` : null,
    ].filter((part): part is string => part != null);
    recordAttempt({ at, outcome: 'success', detail: parts.join(' · ') });
  } catch (error) {
    console.warn('[nutritionSync] Failed to write meal nutrition to Health Connect', error);
    recordAttempt({ at, outcome: 'error', detail: describeError(error) });
  }
}

/**
 * Best-effort cleanup so deleting a meal in RunMate does not leave an orphaned Nutrition
 * record behind in Health Connect (and therefore in Samsung Health, which reads from it).
 * A no-op when the item was never synced (no `healthConnectRecordId` on it) — including
 * every meal saved before this cleanup existed, which cannot be cleaned up automatically.
 */
export async function deleteMealNutritionRecord(item: LocalHistoryItem): Promise<void> {
  if (item.type !== 'meal') return;
  const recordId = readHealthConnectRecordId(item.data);
  if (!recordId) return;
  try {
    await MealNutrition.deleteMealNutrition({ recordId });
  } catch (error) {
    console.warn('[nutritionSync] Failed to delete meal nutrition from Health Connect', error);
  }
}

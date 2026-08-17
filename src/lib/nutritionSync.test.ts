import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Health } from '@capgo/capacitor-health';
import type { LocalHistoryItem } from '@/lib/localHistory';
import {
  checkNutritionSyncAuthorization,
  deleteMealNutritionRecord,
  loadLastNutritionSyncAttempt,
  loadNutritionSyncEnabled,
  requestNutritionSyncAuthorization,
  saveNutritionSyncEnabled,
  syncMealNutritionToHealthConnect,
} from '@/lib/nutritionSync';

vi.mock('@capgo/capacitor-health', () => ({
  Health: {
    isAvailable: vi.fn(),
    requestAuthorization: vi.fn(),
    checkAuthorization: vi.fn(),
  },
}));

const { saveMealNutritionMock, deleteMealNutritionMock, patchHistoryItemDataMock } = vi.hoisted(() => ({
  saveMealNutritionMock: vi.fn(),
  deleteMealNutritionMock: vi.fn(),
  patchHistoryItemDataMock: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({ saveMealNutrition: saveMealNutritionMock, deleteMealNutrition: deleteMealNutritionMock }),
}));
vi.mock('@/lib/cloudHistory', () => ({ patchHistoryItemData: patchHistoryItemDataMock }));

function mealItem(overrides: { data?: Record<string, unknown>; recordedAt?: string } = {}): LocalHistoryItem {
  return {
    id: 'meal-2026-08-14-1',
    type: 'meal',
    createdAt: '2026-08-14T12:00:00.000Z',
    recordedAt: overrides.recordedAt ?? '2026-08-14T12:00:00.000Z',
    data: { nutrition: { caloriesKcal: null, proteinG: null, carbsG: null, fatG: null }, ...overrides.data },
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(Health.isAvailable).mockReset();
  vi.mocked(Health.requestAuthorization).mockReset();
  vi.mocked(Health.checkAuthorization).mockReset();
  saveMealNutritionMock.mockReset();
  deleteMealNutritionMock.mockReset();
  patchHistoryItemDataMock.mockReset();
  patchHistoryItemDataMock.mockResolvedValue({ ok: true });
  // Fixed "now" well after every recordedAt fixture below, so start/end times land in
  // the past unless a test deliberately picks a recordedAt after this instant.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('nutrition sync preference storage', () => {
  it('defaults to disabled and persists across load/save', () => {
    expect(loadNutritionSyncEnabled()).toBe(false);
    saveNutritionSyncEnabled(true);
    expect(loadNutritionSyncEnabled()).toBe(true);
    saveNutritionSyncEnabled(false);
    expect(loadNutritionSyncEnabled()).toBe(false);
  });
});

describe('requestNutritionSyncAuthorization', () => {
  it('reports unavailable when Health Connect is not available on this device', async () => {
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: false });
    await expect(requestNutritionSyncAuthorization()).resolves.toBe('unavailable');
    expect(Health.requestAuthorization).not.toHaveBeenCalled();
  });

  it('reports granted only when dietaryEnergyConsumed is in writeAuthorized', async () => {
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.requestAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    await expect(requestNutritionSyncAuthorization()).resolves.toBe('granted');
  });

  it('reports denied when the user declines the write permission', async () => {
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.requestAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: [], writeDenied: ['dietaryEnergyConsumed'] });
    await expect(requestNutritionSyncAuthorization()).resolves.toBe('denied');
  });
});

describe('checkNutritionSyncAuthorization', () => {
  it('does not prompt the user, only checks status', async () => {
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    await expect(checkNutritionSyncAuthorization()).resolves.toBe('granted');
    expect(Health.requestAuthorization).not.toHaveBeenCalled();
  });
});

describe('syncMealNutritionToHealthConnect', () => {
  it('does nothing when the preference is off, without checking authorization', async () => {
    saveNutritionSyncEnabled(false);
    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } } }));
    expect(Health.checkAuthorization).not.toHaveBeenCalled();
    expect(saveMealNutritionMock).not.toHaveBeenCalled();
  });

  it('does nothing when every nutrition value is missing, since missing must never become zero', async () => {
    saveNutritionSyncEnabled(true);
    await syncMealNutritionToHealthConnect(mealItem());
    expect(saveMealNutritionMock).not.toHaveBeenCalled();
  });

  it('does nothing when authorization is not granted', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: [], writeDenied: ['dietaryEnergyConsumed'] });
    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } } }));
    expect(saveMealNutritionMock).not.toHaveBeenCalled();
  });

  it('writes calories and every macro together when enabled and authorized', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 650, proteinG: 30, carbsG: 80, fatG: 20 } } }));

    expect(saveMealNutritionMock).toHaveBeenCalledWith({
      caloriesKcal: 650,
      proteinG: 30,
      carbsG: 80,
      fatG: 20,
      name: null,
      mealType: null,
      startDate: '2026-08-14T11:59:00.000Z',
      endDate: '2026-08-14T12:00:00.000Z',
    });
  });

  it('sends the detected food names and meal type when the meal has them', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });

    await syncMealNutritionToHealthConnect(mealItem({
      data: {
        nutrition: { caloriesKcal: 500 },
        mealType: 'lunch',
        detectedFoods: [{ name: 'ข้าวผัดกะเพราไก่' }, { name: 'น้ำเปล่า' }, { name: '' }],
      },
    }));

    expect(saveMealNutritionMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'ข้าวผัดกะเพราไก่, น้ำเปล่า',
      mealType: 'lunch',
    }));
  });

  it('sends null name/mealType instead of inventing them when the meal has neither', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 }, detectedFoods: [] } }));

    expect(saveMealNutritionMock).toHaveBeenCalledWith(expect.objectContaining({ name: null, mealType: null }));
  });

  it('persists the returned Health Connect record ID onto the meal so it can be deleted later', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-42' });
    const item = mealItem({ data: { nutrition: { caloriesKcal: 400 } } });

    await syncMealNutritionToHealthConnect(item);

    expect(patchHistoryItemDataMock).toHaveBeenCalledWith(item, { healthConnectRecordId: 'hc-record-42' });
  });

  it('writes a partial macro set as-is, leaving unknown values null rather than inventing them', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 400 } } }));

    expect(saveMealNutritionMock).toHaveBeenCalledWith(expect.objectContaining({
      caloriesKcal: 400,
      proteinG: null,
      carbsG: null,
      fatG: null,
    }));
  });

  it('converts a +HH:MM-offset recordedAt (as produced by dateKeyToRecordedAt) to a Z-suffixed UTC string, since the native plugin only accepts Instant.parse-compatible UTC dates', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } }, recordedAt: '2026-08-14T12:00:00+07:00' }));

    expect(saveMealNutritionMock).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2026-08-14T04:59:00.000Z',
      endDate: '2026-08-14T05:00:00.000Z',
    }));
  });

  it('clamps a same-day recordedAt that falls after the current moment, since Health Connect rejects a future start time', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });
    // "now" is fixed at 2026-08-15T00:00:00Z; a noon-Bangkok placeholder for the same day
    // (2026-08-15T12:00:00+07:00 = 05:00:00Z) is later than "now" and must be clamped.
    vi.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } }, recordedAt: '2026-08-15T12:00:00+07:00' }));

    expect(saveMealNutritionMock).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2026-08-14T23:59:00.000Z',
      endDate: '2026-08-15T00:00:00.000Z',
    }));
  });

  it('makes endDate strictly after startDate, since Health Connect rejects an equal start/end interval', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } } }));

    const call = saveMealNutritionMock.mock.calls[0][0];
    expect(new Date(call.endDate).getTime()).toBeGreaterThan(new Date(call.startDate).getTime());
  });

  it('swallows a native write failure instead of throwing, so it never blocks the meal save', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockRejectedValue(new Error('native failure'));

    await expect(syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } } }))).resolves.toBeUndefined();
  });
});

describe('deleteMealNutritionRecord', () => {
  it('does nothing for a non-meal item', async () => {
    await deleteMealNutritionRecord({ id: 'sleep-1', type: 'sleep', createdAt: '2026-08-14T00:00:00.000Z', data: { healthConnectRecordId: 'hc-1' } });
    expect(deleteMealNutritionMock).not.toHaveBeenCalled();
  });

  it('does nothing when the meal was never synced to Health Connect', async () => {
    await deleteMealNutritionRecord(mealItem());
    expect(deleteMealNutritionMock).not.toHaveBeenCalled();
  });

  it('deletes the matching Health Connect record when one was recorded on the meal', async () => {
    deleteMealNutritionMock.mockResolvedValue(undefined);
    await deleteMealNutritionRecord(mealItem({ data: { healthConnectRecordId: 'hc-record-99' } }));
    expect(deleteMealNutritionMock).toHaveBeenCalledWith({ recordId: 'hc-record-99' });
  });

  it('swallows a native delete failure instead of throwing, so it never blocks deleting the meal from RunMate', async () => {
    deleteMealNutritionMock.mockRejectedValue(new Error('native delete failure'));
    await expect(deleteMealNutritionRecord(mealItem({ data: { healthConnectRecordId: 'hc-record-99' } }))).resolves.toBeUndefined();
  });
});

describe('loadLastNutritionSyncAttempt', () => {
  it('records why a sync silently did nothing, since the sync itself never surfaces an error to the caller', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: [], writeDenied: ['dietaryEnergyConsumed'] });

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } } }));

    expect(loadLastNutritionSyncAttempt()).toMatchObject({ outcome: 'skipped_not_authorized', detail: 'denied' });
  });

  it('records a successful write, including which macros were sent', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockResolvedValue({ recordId: 'hc-record-1' });

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500, proteinG: 25 } } }));

    expect(loadLastNutritionSyncAttempt()).toMatchObject({ outcome: 'success', detail: '500 kcal · 25g protein' });
  });

  it('records a native write failure instead of only logging it invisibly', async () => {
    saveNutritionSyncEnabled(true);
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
    vi.mocked(Health.checkAuthorization).mockResolvedValue({ readAuthorized: [], readDenied: [], writeAuthorized: ['dietaryEnergyConsumed'], writeDenied: [] });
    saveMealNutritionMock.mockRejectedValue(new Error('native failure'));

    await syncMealNutritionToHealthConnect(mealItem({ data: { nutrition: { caloriesKcal: 500 } } }));

    expect(loadLastNutritionSyncAttempt()).toMatchObject({ outcome: 'error', detail: 'native failure' });
  });
});

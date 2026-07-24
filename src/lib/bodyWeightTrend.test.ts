import { describe, expect, it } from 'vitest';
import { buildBodyWeightTrend } from '@/lib/bodyWeightTrend';
import type { LocalHistoryItem } from '@/lib/localHistory';

const TODAY = '2026-07-24';

function bodyItem(date: string, weightKg: number, bodyFatPercent: number | null = null): LocalHistoryItem {
  return {
    id: `body-${date}`,
    type: 'body',
    createdAt: `${date}T07:00:00.000Z`,
    recordedAt: `${date}T07:00:00.000Z`,
    dateKey: date,
    data: { extracted: { date, weightKg, bodyFatPercent } },
  } as LocalHistoryItem;
}

describe('buildBodyWeightTrend', () => {
  it('returns no_data insight when there are no body items', () => {
    const result = buildBodyWeightTrend([], 7, TODAY);
    expect(result.insight.direction).toBe('no_data');
    expect(result.hasEnoughData).toBe(false);
    expect(result.points).toHaveLength(7);
    expect(result.points.every((point) => point.weightKg === null)).toBe(true);
  });

  it('reports steady with a single reading', () => {
    const items = [bodyItem(TODAY, 70.2)];
    const result = buildBodyWeightTrend(items, 7, TODAY);
    expect(result.insight.direction).toBe('steady');
    expect(result.insight.summary).toContain('70.2');
    expect(result.hasEnoughData).toBe(false);
  });

  it('detects a downward trend', () => {
    const items = [bodyItem('2026-07-18', 72), bodyItem(TODAY, 70)];
    const result = buildBodyWeightTrend(items, 7, TODAY);
    expect(result.insight.direction).toBe('down');
    expect(result.hasEnoughData).toBe(true);
  });

  it('detects an upward trend', () => {
    const items = [bodyItem('2026-07-18', 68), bodyItem(TODAY, 70)];
    const result = buildBodyWeightTrend(items, 7, TODAY);
    expect(result.insight.direction).toBe('up');
  });

  it('treats small fluctuations as steady', () => {
    const items = [bodyItem('2026-07-18', 70.1), bodyItem(TODAY, 70.3)];
    const result = buildBodyWeightTrend(items, 7, TODAY);
    expect(result.insight.direction).toBe('steady');
  });

  it('keeps the latest reading per day when multiple exist', () => {
    const morning: LocalHistoryItem = { ...bodyItem(TODAY, 71), recordedAt: `${TODAY}T01:00:00.000Z` };
    const evening: LocalHistoryItem = { ...bodyItem(TODAY, 70.5), recordedAt: `${TODAY}T20:00:00.000Z` };
    const result = buildBodyWeightTrend([morning, evening], 7, TODAY);
    const todayPoint = result.points.find((point) => point.date === TODAY);
    expect(todayPoint?.weightKg).toBe(70.5);
  });

  it('carries bodyFatPercent through to points and logs', () => {
    const items = [bodyItem(TODAY, 70, 18.4)];
    const result = buildBodyWeightTrend(items, 7, TODAY);
    expect(result.logs[0].bodyFatPercent).toBe(18.4);
    const todayPoint = result.points.find((point) => point.date === TODAY);
    expect(todayPoint?.bodyFatPercent).toBe(18.4);
  });

  it('ignores items outside the requested window', () => {
    const items = [bodyItem('2026-06-01', 65)];
    const result = buildBodyWeightTrend(items, 7, TODAY);
    expect(result.logs).toHaveLength(0);
    expect(result.insight.direction).toBe('no_data');
  });
});

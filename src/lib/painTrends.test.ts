import { describe, expect, it } from 'vitest';
import { buildPainTrend } from '@/lib/painTrends';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { PainLog } from '@/types/pain';

function painItem(date: string, overrides: Partial<PainLog> = {}): LocalHistoryItem {
  const data: Partial<PainLog> = {
    painLocation: 'Right Knee',
    painSide: 'right',
    painLevel: 4,
    startedWhen: 'during_run',
    painType: [],
    painfulWhen: [],
    swellingOrRedness: 'no',
    canBearWeight: 'yes',
    riskLevel: 'low',
    trainingImpact: 'run_ok_easy',
    coachAdvice: '',
    redFlags: [],
    createdAt: `${date}T12:00:00.000Z`,
    ...overrides,
  };
  return { id: `pain-${date}`, type: 'pain', createdAt: `${date}T12:00:00.000Z`, dateKey: date, data } as unknown as LocalHistoryItem;
}

describe('buildPainTrend', () => {
  it('reports no data when nothing has been logged', () => {
    const result = buildPainTrend([], 7, '2026-07-24');
    expect(result.insight.direction).toBe('no_data');
    expect(result.hasActivePain).toBe(false);
    expect(result.points).toHaveLength(7);
    expect(result.points.every((point) => point.painLevel == null)).toBe(true);
  });

  it('detects an improving trend when recent pain is lower than earlier pain', () => {
    const items = [
      painItem('2026-07-18', { painLevel: 7 }),
      painItem('2026-07-19', { painLevel: 6 }),
      painItem('2026-07-22', { painLevel: 2 }),
      painItem('2026-07-23', { painLevel: 1 }),
    ];
    const result = buildPainTrend(items, 7, '2026-07-24');
    expect(result.insight.direction).toBe('improving');
    expect(result.hasActivePain).toBe(true);
  });

  it('detects a worsening trend when recent pain is higher than earlier pain', () => {
    const items = [
      painItem('2026-07-18', { painLevel: 1 }),
      painItem('2026-07-19', { painLevel: 2 }),
      painItem('2026-07-22', { painLevel: 6 }),
      painItem('2026-07-23', { painLevel: 7 }),
    ];
    const result = buildPainTrend(items, 7, '2026-07-24');
    expect(result.insight.direction).toBe('worsening');
  });

  it('treats the latest resolved report as improving regardless of history', () => {
    const items = [
      painItem('2026-07-20', { painLevel: 6 }),
      painItem('2026-07-23', { painLevel: 0, resolved: true, status: 'resolved', resolvedAt: '2026-07-23T12:00:00.000Z' }),
    ];
    const result = buildPainTrend(items, 7, '2026-07-24');
    expect(result.insight.direction).toBe('improving');
    expect(result.hasActivePain).toBe(false);
  });

  it('keeps a red-flag report active even when marked resolved', () => {
    const items = [
      painItem('2026-07-23', { painLevel: 5, resolved: true, status: 'resolved', swellingOrRedness: 'yes' }),
    ];
    const result = buildPainTrend(items, 7, '2026-07-24');
    expect(result.hasActivePain).toBe(true);
  });

  it('respects an explicit user-selected recovery status override', () => {
    const items = [painItem('2026-07-23', { painLevel: 3, recoveryStatus: 'cleared_normal' })];
    const result = buildPainTrend(items, 7, '2026-07-24');
    expect(result.hasActivePain).toBe(false);
  });

  it('keeps only the worst report of a day when multiple are logged', () => {
    const items = [
      painItem('2026-07-23', { painLevel: 2, painLocation: 'Ankle' }),
      painItem('2026-07-23', { painLevel: 6, painLocation: 'Knee' }),
    ];
    const result = buildPainTrend(items, 7, '2026-07-24');
    const day = result.points.find((point) => point.date === '2026-07-23');
    expect(day?.painLevel).toBe(6);
    expect(day?.location).toBe('Knee');
  });
});

import { describe, expect, it } from 'vitest';
import type { HealthSample } from '@capgo/capacitor-health';
import { estimateSleepHeartRate, mapSamsungSleepSample } from './samsungSleepSync';

describe('Samsung Health sleep importer', () => {
  it('maps a Samsung Health sample into an idempotent history item', () => {
    const sample: HealthSample = {
      dataType: 'sleep',
      value: 375,
      unit: 'minute',
      startDate: '2026-07-17T15:30:00.000Z',
      endDate: '2026-07-17T22:40:00.000Z',
      sourceId: 'com.sec.android.app.shealth',
      sourceName: 'Samsung Health',
      platformId: 'sleep-record-123',
      hasStageData: true,
      stages: [
        { stage: 'awake', startDate: '2026-07-17T15:30:00.000Z', endDate: '2026-07-17T16:25:00.000Z', durationMinutes: 55 },
        { stage: 'rem', startDate: '2026-07-17T16:25:00.000Z', endDate: '2026-07-17T18:16:00.000Z', durationMinutes: 111 },
        { stage: 'light', startDate: '2026-07-17T18:16:00.000Z', endDate: '2026-07-17T21:49:00.000Z', durationMinutes: 213 },
        { stage: 'deep', startDate: '2026-07-17T21:49:00.000Z', endDate: '2026-07-17T22:40:00.000Z', durationMinutes: 51 },
      ],
    };

    const first = mapSamsungSleepSample(sample);
    const second = mapSamsungSleepSample(sample);
    expect(first?.id).toBe(second?.id);
    expect(first?.dateKey).toBe('2026-07-18');
    expect(first?.source).toMatchObject({ provider: 'samsung_health', importType: 'health_connect' });
    const extracted = (first?.data as { extracted: Record<string, unknown> }).extracted;
    expect(extracted.actualSleepDurationMinutes).toBe(375);
    expect(extracted.timeInBedMinutes).toBe(430);
    expect(extracted.sleepStageMinutes).toEqual({ awake: 55, rem: 111, light: 213, deep: 51 });
  });

  it('rejects invalid intervals instead of creating corrupt sleep records', () => {
    expect(mapSamsungSleepSample({
      dataType: 'sleep', value: 10, unit: 'minute',
      startDate: '2026-07-18T02:00:00.000Z', endDate: '2026-07-18T01:00:00.000Z',
    })).toBeNull();
  });

  it('attributes an overnight Samsung session to its Bangkok wake date', () => {
    const item = mapSamsungSleepSample({
      dataType: 'sleep', value: 353, unit: 'minute',
      startDate: '2026-07-09T16:18:00.000Z',
      endDate: '2026-07-09T23:00:00.000Z',
      sourceId: 'com.sec.android.app.shealth',
      platformId: 'overnight-session',
    });
    expect(item?.dateKey).toBe('2026-07-10');
  });

  it('keeps a same-day sleep session on that day', () => {
    const item = mapSamsungSleepSample({
      dataType: 'sleep', value: 45, unit: 'minute',
      startDate: '2026-07-19T05:00:00.000Z',
      endDate: '2026-07-19T05:45:00.000Z',
      sourceId: 'com.sec.android.app.shealth',
      platformId: 'daytime-session',
    });
    expect(item?.dateKey).toBe('2026-07-19');
  });

  it('matches Samsung recovery signals to the sleep window', () => {
    const sleep: HealthSample = {
      dataType: 'sleep', value: 360, unit: 'minute',
      startDate: '2026-07-09T16:00:00.000Z', endDate: '2026-07-09T23:00:00.000Z',
      sourceId: 'com.sec.android.app.shealth', platformId: 'sleep-with-signals',
    };
    const signal = (dataType: HealthSample['dataType'], value: number, startDate: string, unit: HealthSample['unit']): HealthSample => ({
      dataType, value, unit, startDate, endDate: startDate, sourceId: 'com.sec.android.app.shealth',
    });
    const item = mapSamsungSleepSample(sleep, {
      heartRateVariability: [
        signal('heartRateVariability', 100, '2026-07-09T18:00:00.000Z', 'millisecond'),
        signal('heartRateVariability', 110, '2026-07-09T20:00:00.000Z', 'millisecond'),
      ],
      restingHeartRate: [signal('restingHeartRate', 50, '2026-07-10T01:00:00.000Z', 'bpm')],
      respiratoryRate: [signal('respiratoryRate', 15.2, '2026-07-09T19:00:00.000Z', 'count')],
      heartRate: [],
    });
    const extracted = (item?.data as { extracted: Record<string, unknown> }).extracted;
    expect(extracted.hrv).toBe(105);
    expect(extracted.avgSleepingHrv).toBe(105);
    expect(extracted.restingHR).toBe(50);
    expect(extracted.avgRespiratoryRate).toBe(15.2);
  });

  it('estimates resting HR from sufficiently covered Samsung sleep-window heart rate', () => {
    const startMs = Date.parse('2026-07-09T16:00:00.000Z');
    const endMs = Date.parse('2026-07-09T18:00:00.000Z');
    const samples = Array.from({ length: 13 }, (_, index): HealthSample => ({
      dataType: 'heartRate',
      value: [64, 62, 61, 59, 58, 57, 56, 58, 60, 61, 63, 62, 60][index],
      unit: 'bpm',
      startDate: new Date(startMs + index * 10 * 60_000).toISOString(),
      endDate: new Date(startMs + index * 10 * 60_000).toISOString(),
      sourceId: 'com.sec.android.app.shealth',
    }));
    expect(estimateSleepHeartRate(samples, startMs, endMs)).toEqual({
      average: 60,
      resting: 58,
      sampleCount: 13,
      coveragePercent: 100,
    });

    const sleep: HealthSample = {
      dataType: 'sleep', value: 110, unit: 'minute',
      startDate: new Date(startMs).toISOString(), endDate: new Date(endMs).toISOString(),
      sourceId: 'com.sec.android.app.shealth', platformId: 'sleep-with-generic-hr',
    };
    const item = mapSamsungSleepSample(sleep, {
      heartRateVariability: [], restingHeartRate: [], respiratoryRate: [], heartRate: samples,
    });
    const extracted = (item?.data as { extracted: Record<string, unknown> }).extracted;
    expect(extracted.restingHR).toBe(58);
    expect(extracted.avgSleepingHeartRate).toBe(60);
    expect(extracted.restingHRSource).toBe('estimated_sleep_hr');
    expect(extracted.sleepHeartRateCoveragePercent).toBe(100);
  });

  it('does not estimate resting HR from sparse sleep-window samples', () => {
    const startMs = Date.parse('2026-07-09T16:00:00.000Z');
    const endMs = Date.parse('2026-07-09T22:00:00.000Z');
    const samples = [0, 120, 240, 360].map((minutes): HealthSample => ({
      dataType: 'heartRate', value: 60, unit: 'bpm',
      startDate: new Date(startMs + minutes * 60_000).toISOString(),
      endDate: new Date(startMs + minutes * 60_000).toISOString(),
      sourceId: 'com.sec.android.app.shealth',
    }));
    expect(estimateSleepHeartRate(samples, startMs, endMs)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { selectLatestSamsungWeight } from './samsungProfileSync';
import type { HealthSample } from '@capgo/capacitor-health';

describe('Samsung Profile Sync', () => {
  it('selects the latest plausible Samsung Health weight only', () => {
    const samples = [
      sample(68.2, '2026-07-18T01:00:00.000Z', 'com.sec.android.app.shealth'),
      sample(67.9, '2026-07-19T01:00:00.000Z', 'com.sec.android.app.shealth'),
      sample(70, '2026-07-20T01:00:00.000Z', 'another.app'),
      sample(500, '2026-07-21T01:00:00.000Z', 'com.sec.android.app.shealth'),
    ];
    expect(selectLatestSamsungWeight(samples)?.value).toBe(67.9);
  });
});

function sample(value: number, startDate: string, sourceId: string): HealthSample {
  return { dataType: 'weight', value, unit: 'kilogram', startDate, endDate: startDate, sourceId };
}

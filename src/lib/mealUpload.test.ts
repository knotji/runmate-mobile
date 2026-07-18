import { describe, expect, it } from 'vitest';
import { inferBangkokMealType } from '@/lib/mealUpload';

describe('Bangkok meal type inference', () => {
  it.each([
    ['2026-07-17T22:00:00.000Z', 'breakfast'], // 05:00 Bangkok
    ['2026-07-18T04:00:00.000Z', 'lunch'],     // 11:00 Bangkok
    ['2026-07-18T09:00:00.000Z', 'dinner'],    // 16:00 Bangkok
    ['2026-07-18T15:00:00.000Z', 'snack'],     // 22:00 Bangkok
    ['2026-07-18T21:59:00.000Z', 'snack'],     // 04:59 Bangkok
  ])('maps %s to %s', (timestamp, expected) => {
    expect(inferBangkokMealType(new Date(timestamp))).toBe(expected);
  });
});

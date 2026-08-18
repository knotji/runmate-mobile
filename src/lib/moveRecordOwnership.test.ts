import { describe, expect, it } from 'vitest';
import { isMovementRecord } from './moveRecordOwnership';

describe('Move record ownership', () => {
  it('keeps movement records in Move and leaves health or nutrition records to Health', () => {
    expect(isMovementRecord({ type: 'workout' })).toBe(true);
    expect(isMovementRecord({ type: 'strength' })).toBe(true);
    expect(isMovementRecord({ type: 'meal' })).toBe(false);
    expect(isMovementRecord({ type: 'sleep' })).toBe(false);
    expect(isMovementRecord({ type: 'body' })).toBe(false);
  });
});

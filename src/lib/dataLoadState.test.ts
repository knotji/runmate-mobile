import { describe, expect, it } from 'vitest';
import { healthDataErrorCopy, isHealthConnectPermissionError } from './dataLoadState';

describe('health data load state', () => {
  it('recognizes Health Connect permission failures', () => {
    expect(isHealthConnectPermissionError('Health Connect permission is required.')).toBe(true);
    expect(isHealthConnectPermissionError('Network unavailable')).toBe(false);
  });

  it('keeps permission guidance distinct from transient failures', () => {
    expect(healthDataErrorCopy('Permission denied by Health Connect', 'Sleep Details Are Unavailable')).toMatchObject({
      title: 'Health Connect Access Is Required',
      actionLabel: 'Check Health Connect',
    });
    expect(healthDataErrorCopy('Network unavailable', 'Sleep Details Are Unavailable')).toEqual({
      title: 'Sleep Details Are Unavailable',
      detail: 'Network unavailable',
      actionLabel: 'Try Again',
    });
  });
});

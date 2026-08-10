import { describe, expect, it } from 'vitest';
import { HEALTH_CALENDAR_REFRESH_TTL_MS, shouldRefreshHealthCalendar } from './healthCalendarRefresh';

describe('Health Calendar refresh policy', () => {
  it('reuses a recent successful load when cloud data has not changed', () => {
    expect(shouldRefreshHealthCalendar(1_000, false, 1_000 + HEALTH_CALENDAR_REFRESH_TTL_MS - 1)).toBe(false);
  });

  it('refreshes expired, missing, or explicitly changed data', () => {
    expect(shouldRefreshHealthCalendar(0, false, 10_000)).toBe(true);
    expect(shouldRefreshHealthCalendar(1_000, false, 1_000 + HEALTH_CALENDAR_REFRESH_TTL_MS)).toBe(true);
    expect(shouldRefreshHealthCalendar(9_999, true, 10_000)).toBe(true);
  });
});

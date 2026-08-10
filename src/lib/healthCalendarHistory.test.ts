import { describe, expect, it, vi } from 'vitest';
import { HEALTH_CALENDAR_MAX_ROWS, HEALTH_CALENDAR_PAGE_SIZE, loadHealthCalendarHistory } from './healthCalendarHistory';
import type { LocalHistoryItem } from './localHistory';

function rows(offset: number, count: number): LocalHistoryItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${offset + index}`,
    type: 'meal',
    createdAt: '2026-08-10T00:00:00Z',
    data: {},
  }));
}

describe('Health Calendar history pagination', () => {
  it('loads subsequent pages until the complete history is reached', async () => {
    const loadPage = vi.fn(async (_types, options) => ({
      ok: true as const,
      items: options.offset === 0 ? rows(0, HEALTH_CALENDAR_PAGE_SIZE) : rows(HEALTH_CALENDAR_PAGE_SIZE, 2),
    }));

    const result = await loadHealthCalendarHistory(loadPage);

    expect(result).toMatchObject({ ok: true, limited: false });
    if (result.ok) expect(result.items).toHaveLength(HEALTH_CALENDAR_PAGE_SIZE + 2);
    expect(loadPage).toHaveBeenNthCalledWith(2, ['sleep', 'meal', 'workout', 'strength'], {
      limit: HEALTH_CALENDAR_PAGE_SIZE,
      offset: HEALTH_CALENDAR_PAGE_SIZE,
    });
  });

  it('labels the result limited instead of silently implying older history is complete', async () => {
    const loadPage = vi.fn(async (_types, options) => ({
      ok: true as const,
      items: rows(options.offset ?? 0, HEALTH_CALENDAR_PAGE_SIZE),
    }));

    const result = await loadHealthCalendarHistory(loadPage);

    expect(result).toMatchObject({ ok: true, limited: true });
    if (result.ok) expect(result.items).toHaveLength(HEALTH_CALENDAR_MAX_ROWS);
  });
});

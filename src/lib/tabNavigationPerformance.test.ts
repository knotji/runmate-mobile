import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beginTabNavigation, clearPendingTabNavigation, completeTabNavigation } from './tabNavigationPerformance';

describe('tab navigation performance', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPendingTabNavigation();
  });

  it('records navigation only after the requested tab becomes active', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(180);
    beginTabNavigation('/tabs/health', '/tabs/today');
    expect(completeTabNavigation('/tabs/move')).toBeNull();
    expect(completeTabNavigation('/tabs/health')).toMatchObject({ phase: 'tab_navigation', durationMs: 80, detail: 'Opened /tabs/health' });
    now.mockRestore();
  });

  it('does not create a sample when the active tab is tapped again', () => {
    beginTabNavigation('/tabs/today', '/tabs/today');
    expect(completeTabNavigation('/tabs/today')).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { navigateBackOr, type BackNavigationHistory } from './navigationBack';

function history(action: string, state?: unknown): BackNavigationHistory {
  return { action, location: { pathname: '/weekly-plan', state }, goBack: vi.fn(), push: vi.fn(), replace: vi.fn() };
}

describe('navigateBackOr', () => {
  it('replaces a cold deep link with its explicit in-app origin', () => {
    const value = history('POP', { from: '/tabs/move' });
    navigateBackOr(value, '/tabs/today');
    expect(value.replace).toHaveBeenCalledWith('/tabs/move');
    expect(value.push).not.toHaveBeenCalled();
  });

  it('uses browser history for a page opened through an in-app push', () => {
    const value = history('PUSH');
    navigateBackOr(value, '/tabs/move');
    expect(value.goBack).toHaveBeenCalledOnce();
    expect(value.replace).not.toHaveBeenCalled();
  });

  it('replaces a cold deep link with the owning pillar', () => {
    const value = history('POP');
    navigateBackOr(value, '/tabs/move');
    expect(value.replace).toHaveBeenCalledWith('/tabs/move');
  });
});

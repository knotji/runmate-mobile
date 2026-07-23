import { describe, expect, it } from 'vitest';
import { notificationRouteFromUrl } from './nativeNavigation';

describe('native notification navigation', () => {
  it('accepts only known RunMate notification routes', () => {
    expect(notificationRouteFromUrl('com.runmate.mobile://navigate?route=%2Ftabs%2Frecovery')).toBe('/tabs/recovery');
    expect(notificationRouteFromUrl('com.runmate.mobile://navigate?route=%2Ftabs%2Factivity')).toBe('/tabs/activity');
    expect(notificationRouteFromUrl('com.runmate.mobile://navigate?route=%2Fhealth-connect')).toBe('/health-connect');
    expect(notificationRouteFromUrl('com.runmate.mobile://navigate?route=%2Fprofile-settings')).toBeNull();
  });

  it('ignores authentication and external URLs', () => {
    expect(notificationRouteFromUrl('com.runmate.mobile://auth/callback?code=abc')).toBeNull();
    expect(notificationRouteFromUrl('https://example.com/tabs/recovery')).toBeNull();
    expect(notificationRouteFromUrl('not a url')).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportCrash } from '@/lib/crashReporting';

const recordException = vi.fn();
let isNative = true;

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNative,
    getPlatform: () => 'android',
  },
}));

vi.mock('@capacitor-firebase/crashlytics', () => ({
  FirebaseCrashlytics: { recordException: (...args: unknown[]) => recordException(...args) },
}));

describe('reportCrash', () => {
  beforeEach(() => {
    recordException.mockReset();
    isNative = true;
  });

  it('records a non-fatal exception with context on native Android', async () => {
    await reportCrash(new Error('boom'), 'Page render failed at /tabs/recovery');

    expect(recordException).toHaveBeenCalledWith({ message: 'Page render failed at /tabs/recovery: boom' });
  });

  it('records the plain message when no context is given', async () => {
    await reportCrash(new Error('boom'));

    expect(recordException).toHaveBeenCalledWith({ message: 'boom' });
  });

  it('does nothing outside a native Android platform', async () => {
    isNative = false;

    await reportCrash(new Error('boom'));

    expect(recordException).not.toHaveBeenCalled();
  });

  it('never throws, even if Crashlytics itself fails', async () => {
    recordException.mockRejectedValue(new Error('crashlytics unavailable'));

    await expect(reportCrash(new Error('boom'))).resolves.toBeUndefined();
  });
});

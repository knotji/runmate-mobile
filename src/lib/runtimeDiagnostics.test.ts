import { beforeEach, describe, expect, it } from 'vitest';
import { getLastRuntimeError, recordRuntimeError } from './runtimeDiagnostics';

describe('Runtime Diagnostics', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('stores only a compact error summary for recovery diagnostics', () => {
    recordRuntimeError(new TypeError('Page failed'));
    expect(getLastRuntimeError()).toMatchObject({ name: 'TypeError', message: 'Page failed' });
    expect(window.sessionStorage.getItem('runmate:last-runtime-error')).not.toContain('stack');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { buildSupportDiagnostics } from './aboutDiagnostics';
import { recordPerformanceDiagnostic } from './performanceDiagnostics';

describe('About diagnostics', () => {
  beforeEach(() => window.localStorage.clear());

  it('copies build and timing metadata without health record details', () => {
    recordPerformanceDiagnostic('activity_records', 900, 'success', '314 recent records prepared');
    const result = JSON.parse(buildSupportDiagnostics({
      version: '1.0.0',
      build: '1178',
      builtAt: '2026-07-29T00:00:00.000Z',
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ app: 'RunMate', version: '1.0.0', build: '1178' });
    expect(JSON.stringify(result)).not.toContain('314 recent records');
    expect(result.performance).toEqual([expect.objectContaining({
      phase: 'activity_records',
      latestMs: 900,
      budgetStatus: 'within',
    })]);
  });
});

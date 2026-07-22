import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';
import {
  buildReviewReconciliationInput,
  isUserCorrectedField,
  reconciliationSourceLabel,
  reconciliationSourceRank,
} from '@/lib/reconciliationPolicy';

function item(source: LocalHistoryItem['source'], reconciliationInput?: Record<string, unknown>): LocalHistoryItem {
  return { id: 'record', type: 'workout', createdAt: '2026-07-22T01:00:00Z', source, data: { reconciliationInput } };
}

describe('reconciliation policy', () => {
  it('tracks only values changed during review', () => {
    const result = buildReviewReconciliationInput(
      { duration: '30:00', avgHR: 140, calories: null },
      { duration: '31:00', avgHR: 140, calories: undefined },
      ['duration', 'avgHR', 'calories'],
      '2026-07-22T02:00:00Z',
    );
    expect(result).toEqual({ reviewedAt: '2026-07-22T02:00:00Z', userCorrectedFields: ['duration'] });
  });

  it('recognizes persisted field-level user corrections', () => {
    const record = item(
      { provider: 'generic_image', importType: 'image', importedAt: '2026-07-22T01:00:00Z' },
      { userCorrectedFields: ['avgHR'] },
    );
    expect(isUserCorrectedField(record, 'avgHR')).toBe(true);
    expect(isUserCorrectedField(record, 'maxHR')).toBe(false);
  });

  it('keeps Health Connect ahead of uncorrected uploads and labels both honestly', () => {
    const health = item({ provider: 'samsung_health', importType: 'health_connect', importedAt: '2026-07-22T01:00:00Z' });
    const upload = item({ provider: 'generic_image', importType: 'image', importedAt: '2026-07-22T01:00:00Z' });
    expect(reconciliationSourceRank(health)).toBeGreaterThan(reconciliationSourceRank(upload));
    expect(reconciliationSourceLabel(health)).toBe('Samsung Health');
    expect(reconciliationSourceLabel(upload)).toBe('Manual Upload');
  });
});

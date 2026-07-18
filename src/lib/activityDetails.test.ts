import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildHealthDetail, buildMealDetail } from '@/lib/activityDetails';

const base = (type: LocalHistoryItem['type'], data: unknown): LocalHistoryItem => ({
  id: `${type}-1`, type, createdAt: '2026-07-18T08:00:00.000Z', dateKey: '2026-07-18', data,
});

describe('activity detail presentation', () => {
  it('maps structured meal data without inventing missing macros', () => {
    const detail = buildMealDetail(base('meal', {
      mealType: 'post_run_meal', detectedFoods: [{ name: 'Rice And Chicken', quantity: 1, unit: 'plate' }],
      nutrition: { caloriesKcal: 540, proteinG: 32 }, trainingFit: { hydrationNote: 'Drink water after the run.' },
    }));

    expect(detail.title).toBe('Post Run Meal');
    expect(detail.foods).toEqual([{ name: 'Rice And Chicken', quantity: 1, unit: 'plate', portion: null }]);
    expect(detail.metrics).toEqual([{ label: 'Calories', value: '540 kcal' }, { label: 'Protein', value: '32 g' }]);
    expect(detail.metrics.some((metric) => metric.label === 'Carbs')).toBe(false);
  });

  it('retains a qualitative meal portion separately from quantity and unit', () => {
    const detail = buildMealDetail(base('meal', { detectedFoods: [{ name: 'Carrots', quantity: 1, unit: 'piece', portionEstimate: 'small amount' }], nutrition: {} }));

    expect(detail.foods[0]).toEqual({ name: 'Carrots', quantity: 1, unit: 'piece', portion: 'small amount' });
  });

  it('presents pain safety flags and training guidance', () => {
    const detail = buildHealthDetail(base('pain', {
      painLocation: 'left_knee', painLevel: 6, painSide: 'left', riskLevel: 'high',
      painType: ['sharp'], redFlags: ['Pain At Rest'], canBearWeight: 'no', coachAdvice: 'Avoid running today.',
    }));

    expect(detail.kind).toBe('Pain');
    expect(detail.title).toBe('Left Knee Pain');
    expect(detail.metrics).toContainEqual({ label: 'Pain Level', value: '6 /10' });
    expect(detail.alerts).toEqual(['Pain At Rest', 'Cannot Bear Weight']);
    expect(detail.guidance).toBe('Avoid running today.');
  });

  it('prioritizes a resolved pain state over its previous risk level', () => {
    const detail = buildHealthDetail(base('pain', { painLocation: 'ankle', resolved: true, riskLevel: 'high' }));

    expect(detail.status).toBe('Resolved');
  });

  it('combines sick symptoms and structured safety indicators', () => {
    const detail = buildHealthDetail(base('sick', {
      symptoms: ['sore_throat', 'fatigue'], severity: 'moderate', fever: true,
      trainingDecision: 'rest_only', note: 'Symptoms started this morning.',
    }));

    expect(detail.kind).toBe('Sick');
    expect(detail.tags).toEqual(['Sore Throat', 'Fatigue']);
    expect(detail.alerts).toEqual(['Fever']);
    expect(detail.guidance).toBe('Rest and avoid training until symptoms improve.');
  });
});

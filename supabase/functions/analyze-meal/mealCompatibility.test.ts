import { describe, expect, it } from 'vitest';

import { normalizeMealAnalysis } from './meal-analysis';
import type { MealAnalysis } from '@/types/logs';

// analyze-meal is shared. RunMate reads the answer by picking the fields it
// knows — `data.data as MealAnalysis`, no validation — so new keys are inert
// there only for as long as the old ones keep their shape.
//
// This pins that. It is the same guarantee the coach's planProposal needed, and
// it is checked here rather than assumed because the two apps ship separately
// and only one of them is being changed.

const answer = () => normalizeMealAnalysis({
  detectedFoods: [
    { name: 'ข้าวสวย', portionEstimate: '1 ทัพพี', quantity: 1, unit: 'ทัพพี' },
    { name: 'อกไก่นึ่ง', portionEstimate: '150 กรัม', quantity: 150, unit: 'กรัม' },
  ],
  nutrition: { caloriesKcal: 450, proteinG: 35, carbsG: 55, fatG: 8, fiberG: 2 },
  trainingFit: { coachNote: 'ดีสำหรับก่อนซ้อม', hydrationNote: 'ดื่มน้ำเพิ่ม' },
  confidence: 'high',
  unclearFields: ['ปริมาณข้าว'],
  needsReview: false,
  userCorrectionsApplied: ['ใช้ข้าวสวยตามที่ระบุ'],
  assumptions: ['ประมาณน้ำหนักข้าว'],
  needsClarification: false,
}, 'lunch', 'ไม่เอาหนัง', '', 2);

describe('every field RunMate already reads is unchanged', () => {
  it('keeps the top-level fields it names', () => {
    const result = answer();

    expect(result).toMatchObject({
      mealType: 'lunch',
      mealSlot: 'lunch',
      inputMode: 'image',
      imageCount: 2,
      note: 'ไม่เอาหนัง',
      confidence: 'high',
      needsReview: false,
    });
  });

  it('keeps detectedFoods in the shape it destructures', () => {
    const [food] = answer().detectedFoods;

    expect(food).toEqual({
      name: 'ข้าวสวย',
      portionEstimate: '1 ทัพพี',
      quantity: 1,
      unit: 'ทัพพี',
    });
  });

  it('keeps a quantity the server has always allowed', () => {
    // Grams, not a count. The server bounds this at 1000 and always has; a
    // client bound of 100 is what threw a whole meal away on a device.
    expect(answer().detectedFoods[1].quantity).toBe(150);
  });

  it('keeps nutrition as five nullable numbers', () => {
    expect(answer().nutrition).toEqual({
      caloriesKcal: 450, proteinG: 35, carbsG: 55, fatG: 8, fiberG: 2,
    });
  });

  it('keeps trainingFit and unclearFields', () => {
    const result = answer();

    expect(result.trainingFit).toEqual({ coachNote: 'ดีสำหรับก่อนซ้อม', hydrationNote: 'ดื่มน้ำเพิ่ม' });
    expect(result.unclearFields).toEqual(['ปริมาณข้าว']);
  });

  it('assigns to RunMate\'s own type without a cast', () => {
    // The type is structural: if a field RunMate declares went missing or
    // changed shape, this stops compiling.
    const asRunMateReadsIt: MealAnalysis = answer();

    expect(asRunMateReadsIt.detectedFoods).toHaveLength(2);
  });
});

describe('the new fields are additions, not replacements', () => {
  it('adds exactly the four agreed keys and nothing else', () => {
    const keys = Object.keys(answer()).sort();
    const known = [
      'assumptions', 'clarifyingQuestion', 'confidence', 'detectedFoods', 'imageCount',
      'inputMode', 'mealSlot', 'mealType', 'needsClarification', 'needsReview', 'note',
      'nutrition', 'originalMealText', 'trainingFit', 'unclearFields', 'userCorrectionsApplied',
    ];

    // A key appearing here that nobody agreed to is how a shared contract
    // grows sideways.
    expect(keys).toEqual(known.filter((key) => keys.includes(key)).sort());
    expect(keys).toContain('userCorrectionsApplied');
    expect(keys).toContain('assumptions');
    expect(keys).toContain('needsClarification');
    expect(keys).toContain('clarifyingQuestion');
  });

  it('leaves an answer that carries none of them fully readable', () => {
    // What RunMate sends today: no new keys in, old keys out unchanged.
    const result = normalizeMealAnalysis({
      detectedFoods: [{ name: 'ข้าว' }],
      nutrition: { caloriesKcal: 200 },
    }, 'snack', '', '', 1);

    expect(result.detectedFoods[0].name).toBe('ข้าว');
    expect(result.nutrition.caloriesKcal).toBe(200);
    expect(result.userCorrectionsApplied).toEqual([]);
    expect(result.needsClarification).toBe(false);
  });
});

describe('the bounds this answer is written to', () => {
  // WholeMate validates what this function emits, and the two disagreed: the
  // server allowed a quantity up to 1000 and the client refused above 100, so
  // "อกไก่นึ่ง 150 กรัม" cost a runner a whole meal. Both sides now pin the
  // same number, and this is the half that lives here.
  const withQuantity = (quantity: unknown) => normalizeMealAnalysis({
    detectedFoods: [{ name: 'อกไก่นึ่ง', quantity, unit: 'กรัม' }],
    nutrition: { caloriesKcal: 200 },
  }, 'lunch', '', '', 1).detectedFoods[0].quantity;

  it('sends a quantity in grams, not only a count', () => {
    expect(withQuantity(150)).toBe(150);
    expect(withQuantity(1000)).toBe(1000);
  });

  it('keeps a fractional quantity for half a portion', () => {
    expect(withQuantity(0.5)).toBe(0.5);
  });

  it('falls back to one when the quantity is not a usable number', () => {
    for (const quantity of [-1, 'สองจาน', null, undefined]) {
      expect(withQuantity(quantity), String(quantity)).toBe(1);
    }
  });

  it('clamps an absurd quantity to the bound rather than dropping it', () => {
    // Documented, not endorsed. 50kg of chicken becomes 1kg here, and a
    // clamped number is one nobody wrote — the same objection that made the
    // plan proposal drop out-of-range values instead of pinning them to an
    // edge. Left alone because changing it changes RunMate's answers too.
    //
    // What matters for the seam is that the bound the client validates against
    // and the bound this clamps to are the same number.
    expect(withQuantity(50_000)).toBe(1000);
  });
});

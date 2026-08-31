import { describe, expect, it } from 'vitest';
import { normalizePlanProposal } from './plan-proposal';

const COMPLETE = {
  day: 'Sunday',
  dateKey: '2026-09-01',
  workoutType: 'Recovery',
  durationMin: 30,
  description: 'เดินเบาหรือ mobility',
  purpose: 'ลดโหลดเพื่อฟื้นตัว',
};

describe('a proposal needs a day and a session type', () => {
  it('accepts a complete proposal', () => {
    expect(normalizePlanProposal(COMPLETE)).toMatchObject({
      day: 'Sunday',
      dateKey: '2026-09-01',
      workoutType: 'Recovery',
      durationMin: 30,
    });
  });

  it('drops a proposal with no day, which the app cannot place', () => {
    expect(normalizePlanProposal({ ...COMPLETE, day: undefined })).toBeNull();
    expect(normalizePlanProposal({ ...COMPLETE, day: '   ' })).toBeNull();
  });

  it('drops a proposal with no session type, which says nothing', () => {
    expect(normalizePlanProposal({ ...COMPLETE, workoutType: undefined })).toBeNull();
  });

  it('drops anything that is not an object', () => {
    for (const value of [null, undefined, 'Recovery', 42, ['Recovery']]) {
      expect(normalizePlanProposal(value)).toBeNull();
    }
  });
});

describe('a date is only ever one the model actually supplied', () => {
  it('keeps a well-formed dateKey', () => {
    expect(normalizePlanProposal(COMPLETE)?.dateKey).toBe('2026-09-01');
  });

  it('drops a malformed date rather than repairing it', () => {
    // Deriving a date from a weekday would mean guessing a timezone the context
    // may not carry, and a confidently wrong date is worse than none.
    for (const dateKey of ['01/09/2026', '2026-9-1', 'Sunday', '2026-09-01T00:00:00Z', '']) {
      const proposal = normalizePlanProposal({ ...COMPLETE, dateKey });

      expect(proposal, `dateKey ${dateKey}`).not.toBeNull();
      expect(proposal?.dateKey, `dateKey ${dateKey}`).toBeNull();
    }
  });

  it('keeps the proposal usable when the date is missing entirely', () => {
    const proposal = normalizePlanProposal({ day: 'Sunday', workoutType: 'Rest' });

    expect(proposal).toMatchObject({ day: 'Sunday', workoutType: 'Rest', dateKey: null });
  });
});

describe('impossible numbers are dropped, never clamped', () => {
  it('drops a duration outside the accepted range', () => {
    // A clamped value would be a prescription nobody wrote.
    for (const durationMin of [-5, 601, Number.NaN, Number.POSITIVE_INFINITY, '30']) {
      expect(normalizePlanProposal({ ...COMPLETE, durationMin })?.durationMin, `duration ${durationMin}`).toBeNull();
    }
  });

  it('drops a distance outside the accepted range', () => {
    for (const distanceKm of [-1, 501, 'far']) {
      expect(normalizePlanProposal({ ...COMPLETE, distanceKm })?.distanceKm).toBeNull();
    }
  });

  it('keeps a legitimate zero, which a rest day needs', () => {
    const proposal = normalizePlanProposal({ day: 'Sunday', workoutType: 'Rest', durationMin: 0, distanceKm: 0 });

    expect(proposal).toMatchObject({ durationMin: 0, distanceKm: 0 });
  });

  it('keeps the rest of a proposal when one number is unusable', () => {
    const proposal = normalizePlanProposal({ ...COMPLETE, durationMin: 9999 });

    expect(proposal).toMatchObject({ day: 'Sunday', workoutType: 'Recovery', durationMin: null });
    expect(proposal?.description).toBe('เดินเบาหรือ mobility');
  });
});

describe('the shape stays stable for clients that read it', () => {
  it('always returns every field, so a reader never sees a partial object', () => {
    const proposal = normalizePlanProposal({ day: 'Sunday', workoutType: 'Rest' });

    expect(Object.keys(proposal ?? {}).sort()).toEqual([
      'dateKey', 'day', 'description', 'distanceKm', 'durationMin',
      'purpose', 'targetHr', 'targetPace', 'workoutType',
    ]);
  });

  it('trims and bounds free text rather than passing it through', () => {
    const proposal = normalizePlanProposal({
      day: '  Sunday  ',
      workoutType: '  Recovery  ',
      description: 'x'.repeat(2000),
    });

    expect(proposal?.day).toBe('Sunday');
    expect(proposal?.workoutType).toBe('Recovery');
    expect(proposal?.description).toHaveLength(1000);
  });

  it('carries a weekday name rather than a date, which is how the plan matches days', () => {
    expect(normalizePlanProposal(COMPLETE)?.day).toBe('Sunday');
  });
});

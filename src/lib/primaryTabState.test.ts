import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadCoachDraft,
  loadMoveSelectedDate,
  loadPrimaryTabScroll,
  saveCoachDraft,
  saveMoveSelectedDate,
  savePrimaryTabScroll,
} from './primaryTabState';

describe('primary tab state', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('restores a valid Move date but never opens on a future date', () => {
    saveMoveSelectedDate('2026-08-05', '2026-08-11');
    expect(loadMoveSelectedDate('2026-08-11')).toBe('2026-08-05');
    saveMoveSelectedDate('2026-08-12', '2026-08-11');
    expect(loadMoveSelectedDate('2026-08-11')).toBe('2026-08-11');
    expect(loadMoveSelectedDate('2026-08-12')).toBe('2026-08-12');
  });

  it('keeps a bounded Coach draft for the current app session', () => {
    saveCoachDraft('How should I train today?');
    expect(loadCoachDraft()).toBe('How should I train today?');
    saveCoachDraft('a'.repeat(1200));
    expect(loadCoachDraft()).toHaveLength(1000);
  });

  it('stores independent non-negative scroll positions', () => {
    savePrimaryTabScroll('today', 248.6);
    savePrimaryTabScroll('move', -12);
    expect(loadPrimaryTabScroll('today')).toBe(249);
    expect(loadPrimaryTabScroll('health')).toBe(0);
    expect(loadPrimaryTabScroll('move')).toBe(0);
  });
});

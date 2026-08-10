import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRunMateCachedData } from './appCache';
import { clearActivityStartupSnapshot } from './activityStartupCache';
import { clearAiCoachAnswerCache } from './aiCoach';
import { clearAiCoachChatHistory } from './aiCoachChatHistory';
import { clearHealthCalendarSnapshot } from './healthCalendarStartupCache';
import { clearBodyWeightTrendStartupSnapshot } from './bodyWeightTrendStartupCache';
import { invalidateCoachContextCache } from './coachContextService';
import { clearMealDetailCache } from './mealDetailCache';
import { clearNutritionTrendsStartupSnapshot } from './nutritionTrendsStartupCache';
import { clearPainTrendsStartupSnapshot } from './painTrendsStartupCache';
import { clearProfileSettingsStartupSnapshot } from './profileSettingsStartupCache';
import { clearRecoveryStartupSnapshot } from './recoveryStartupCache';
import { clearRecoveryTrendsStartupSnapshot } from './recoveryTrendsStartupCache';
import { clearWeeklySummaryHistorySnapshot } from './weeklySummaryStartupCache';

vi.mock('./activityStartupCache', () => ({ clearActivityStartupSnapshot: vi.fn() }));
vi.mock('./aiCoach', () => ({ clearAiCoachAnswerCache: vi.fn() }));
vi.mock('./aiCoachChatHistory', () => ({ clearAiCoachChatHistory: vi.fn() }));
vi.mock('./healthCalendarStartupCache', () => ({ clearHealthCalendarSnapshot: vi.fn() }));
vi.mock('./bodyWeightTrendStartupCache', () => ({ clearBodyWeightTrendStartupSnapshot: vi.fn() }));
vi.mock('./coachContextService', () => ({ invalidateCoachContextCache: vi.fn() }));
vi.mock('./mealDetailCache', () => ({ clearMealDetailCache: vi.fn() }));
vi.mock('./nutritionTrendsStartupCache', () => ({ clearNutritionTrendsStartupSnapshot: vi.fn() }));
vi.mock('./painTrendsStartupCache', () => ({ clearPainTrendsStartupSnapshot: vi.fn() }));
vi.mock('./profileSettingsStartupCache', () => ({ clearProfileSettingsStartupSnapshot: vi.fn() }));
vi.mock('./recoveryStartupCache', () => ({ clearRecoveryStartupSnapshot: vi.fn() }));
vi.mock('./recoveryTrendsStartupCache', () => ({ clearRecoveryTrendsStartupSnapshot: vi.fn() }));
vi.mock('./weeklySummaryStartupCache', () => ({ clearWeeklySummaryHistorySnapshot: vi.fn() }));

describe('clearRunMateCachedData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('clears account-scoped device data and temporary caches on sign-out', () => {
    clearRunMateCachedData();

    [
      clearRecoveryStartupSnapshot,
      clearActivityStartupSnapshot,
      clearNutritionTrendsStartupSnapshot,
      clearRecoveryTrendsStartupSnapshot,
      clearMealDetailCache,
      clearBodyWeightTrendStartupSnapshot,
      clearProfileSettingsStartupSnapshot,
      clearPainTrendsStartupSnapshot,
      clearWeeklySummaryHistorySnapshot,
      clearAiCoachAnswerCache,
      clearAiCoachChatHistory,
      clearHealthCalendarSnapshot,
      invalidateCoachContextCache,
    ].forEach((clear) => expect(clear).toHaveBeenCalledOnce());
  });
});

import { clearActivityStartupSnapshot } from './activityStartupCache';
import { clearAiCoachAnswerCache } from './aiCoach';
import { clearBodyWeightTrendStartupSnapshot } from './bodyWeightTrendStartupCache';
import { invalidateCoachContextCache } from './coachContextService';
import { clearMealDetailCache } from './mealDetailCache';
import { clearNutritionTrendsStartupSnapshot } from './nutritionTrendsStartupCache';
import { clearPainTrendsStartupSnapshot } from './painTrendsStartupCache';
import { clearProfileSettingsStartupSnapshot } from './profileSettingsStartupCache';
import { clearRecoveryStartupSnapshot } from './recoveryStartupCache';
import { clearRecoveryTrendsStartupSnapshot } from './recoveryTrendsStartupCache';
import { clearWeeklySummaryHistorySnapshot } from './weeklySummaryStartupCache';
import { clearAllDayHeartRateStore } from './allDayHeartRate';
import { clearStrainCheckIns } from './strainContext';

export function clearRunMateCachedData(): void {
  clearRecoveryStartupSnapshot();
  clearActivityStartupSnapshot();
  clearNutritionTrendsStartupSnapshot();
  clearRecoveryTrendsStartupSnapshot();
  clearMealDetailCache();
  clearBodyWeightTrendStartupSnapshot();
  clearProfileSettingsStartupSnapshot();
  clearPainTrendsStartupSnapshot();
  clearWeeklySummaryHistorySnapshot();
  clearAiCoachAnswerCache();
  clearAllDayHeartRateStore();
  clearStrainCheckIns();
  invalidateCoachContextCache();
}

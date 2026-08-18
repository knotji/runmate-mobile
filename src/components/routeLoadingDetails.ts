import type { PageDataSkeletonVariant } from './PageDataSkeleton';

export type RouteLoadingDetails = { title: string; variant: PageDataSkeletonVariant };

const routeDetails: Record<string, RouteLoadingDetails> = {
  '/tabs/recovery': { title: 'Recovery', variant: 'recovery' },
  '/tabs/activity': { title: 'Activity', variant: 'activity' },
  '/tabs/today': { title: 'Today', variant: 'recovery' },
  '/tabs/health': { title: 'Health', variant: 'health' },
  '/tabs/move': { title: 'Move', variant: 'activity' },
  '/tabs/you': { title: 'You', variant: 'profile' },
  '/tabs/coach': { title: 'Coach', variant: 'coach' },
  '/tabs/log': { title: 'Log', variant: 'profile' },
  '/tabs/upload': { title: 'Log', variant: 'profile' },
  '/tabs/settings': { title: 'You', variant: 'profile' },
  '/tabs/more': { title: 'You', variant: 'profile' },
  '/ai-coach': { title: 'AI Coach', variant: 'coach' },
  '/race-goal': { title: 'Race Goal', variant: 'race' },
  '/weekly-summary': { title: 'Weekly Summary', variant: 'summary' },
  '/weekly-recap': { title: 'Your Recap', variant: 'summary' },
  '/profile-settings': { title: 'Profile & Settings', variant: 'profile' },
  '/notifications': { title: 'Notifications', variant: 'notifications' },
  '/health-connect': { title: 'Health Connect', variant: 'health' },
  '/about': { title: 'About WholeMate', variant: 'profile' },
  '/sleep': { title: 'Sleep Details', variant: 'detail' },
  '/sleep-window': { title: 'Sleep Window', variant: 'sleep' },
  '/recovery-trends': { title: 'Recovery Trends', variant: 'trends' },
  '/nutrition-trends': { title: 'Nutrition Trends', variant: 'nutrition' },
};

export function loadingDetailsForPath(pathname: string): RouteLoadingDetails {
  if (pathname.startsWith('/activity/workout/')) return { title: 'Workout Detail', variant: 'detail' };
  if (pathname.startsWith('/activity/meal/')) return { title: 'Meal Detail', variant: 'detail' };
  if (pathname.startsWith('/activity/health/')) return { title: 'Health Detail', variant: 'detail' };
  return routeDetails[pathname] ?? { title: 'WholeMate', variant: 'profile' };
}

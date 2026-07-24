const loaders = {
  '/ai-coach': () => import('@/pages/AiCoachPage'),
  '/race-goal': () => import('@/pages/RaceGoalPage'),
  '/weekly-summary': () => import('@/pages/WeeklySummaryPage'),
  '/profile-settings': () => import('@/pages/ProfileSettingsPage'),
  '/notifications': () => import('@/pages/NotificationsPage'),
  '/health-connect': () => import('@/pages/HealthTestPage'),
  '/privacy-data': () => import('@/pages/PrivacyDataPage'),
} as const;

export type MorePagePath = keyof typeof loaders;
type MorePageModule = Awaited<ReturnType<(typeof loaders)[MorePagePath]>>;

const pending = new Map<MorePagePath, Promise<MorePageModule>>();

export function loadMorePage(path: MorePagePath): Promise<MorePageModule> {
  const existing = pending.get(path);
  if (existing) return existing;
  const request = loaders[path]() as Promise<MorePageModule>;
  pending.set(path, request);
  request.catch(() => pending.delete(path));
  return request;
}

export function preloadMorePages(): Promise<MorePageModule[]> {
  return Promise.all((Object.keys(loaders) as MorePagePath[]).map(loadMorePage));
}

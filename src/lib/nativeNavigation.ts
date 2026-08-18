const NATIVE_NAVIGATION_PROTOCOL = 'com.runmate.mobile:';
const ALLOWED_NOTIFICATION_ROUTES = new Set([
  '/tabs/today',
  '/tabs/health',
  '/tabs/move',
  '/tabs/you',
  '/tabs/coach',
  '/tabs/recovery',
  '/tabs/activity',
  '/health-connect',
]);

export function notificationRouteFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== NATIVE_NAVIGATION_PROTOCOL || url.hostname !== 'navigate') return null;
    const route = url.searchParams.get('route');
    return route && ALLOWED_NOTIFICATION_ROUTES.has(route) ? route : null;
  } catch {
    return null;
  }
}

export const APP_NAVIGATE_EVENT = 'runmate:navigate';

export function navigateToAppRoute(route: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_NAVIGATE_EVENT, { detail: { route } }));
}

export function onAppNavigate(callback: (route: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ route: string }>;
    if (customEvent.detail?.route) {
      callback(customEvent.detail.route);
    }
  };
  window.addEventListener(APP_NAVIGATE_EVENT, handler);
  return () => window.removeEventListener(APP_NAVIGATE_EVENT, handler);
}

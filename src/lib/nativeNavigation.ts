const NATIVE_NAVIGATION_PROTOCOL = 'com.runmate.mobile:';
const ALLOWED_NOTIFICATION_ROUTES = new Set(['/tabs/recovery', '/tabs/activity', '/health-connect']);

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

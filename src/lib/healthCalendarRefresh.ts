export const HEALTH_CALENDAR_REFRESH_TTL_MS = 5 * 60 * 1000;

export function shouldRefreshHealthCalendar(
  lastSuccessfulLoadAt: number,
  dataChanged: boolean,
  now = Date.now(),
): boolean {
  if (dataChanged || lastSuccessfulLoadAt <= 0) return true;
  return now - lastSuccessfulLoadAt >= HEALTH_CALENDAR_REFRESH_TTL_MS;
}

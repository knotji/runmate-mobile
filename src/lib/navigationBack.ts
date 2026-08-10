export type BackNavigationHistory = {
  action: string;
  location: { pathname: string; state?: unknown };
  goBack: () => void;
  push: (path: string) => void;
  replace: (path: string) => void;
};

/**
 * Returns to the in-app origin when a detail page was pushed normally, but
 * replaces a cold deep link with its owning pillar instead of leaving the app.
 */
export function navigateBackOr(history: BackNavigationHistory, fallback: string): void {
  if (history.action === 'PUSH') {
    history.goBack();
    return;
  }
  const from = originFromState(history.location.state);
  history.replace(from && from !== history.location.pathname ? from : fallback);
}

function originFromState(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const from = Reflect.get(state, 'from');
  return typeof from === 'string' && from.startsWith('/') ? from : null;
}

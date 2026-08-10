import { recordPerformanceDiagnostic, type PerformanceDiagnosticEntry } from './performanceDiagnostics';

type PendingTabNavigation = { targetPath: string; startedAt: number };

let pending: PendingTabNavigation | null = null;

export function beginTabNavigation(targetPath: string, currentPath: string): void {
  pending = targetPath === currentPath ? null : { targetPath, startedAt: monotonicNow() };
}

export function completeTabNavigation(currentPath: string): PerformanceDiagnosticEntry | null {
  if (!pending || pending.targetPath !== currentPath) return null;
  const duration = monotonicNow() - pending.startedAt;
  const targetPath = pending.targetPath;
  pending = null;
  return recordPerformanceDiagnostic('tab_navigation', duration, 'success', `Opened ${targetPath}`);
}

export function clearPendingTabNavigation(): void {
  pending = null;
}

function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

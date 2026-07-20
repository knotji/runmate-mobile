export const LAST_RUNTIME_ERROR_KEY = 'runmate:last-runtime-error';

export type RuntimeErrorDiagnostic = {
  at: string;
  path: string;
  name: string;
  message: string;
};

export function recordRuntimeError(error: Error): RuntimeErrorDiagnostic {
  const diagnostic = {
    at: new Date().toISOString(),
    path: window.location.pathname,
    name: error.name || 'Error',
    message: error.message || 'Unexpected Application Error',
  };
  try { window.sessionStorage.setItem(LAST_RUNTIME_ERROR_KEY, JSON.stringify(diagnostic)); }
  catch { /* Recovery UI must remain available when storage is blocked. */ }
  return diagnostic;
}

export function getLastRuntimeError(): RuntimeErrorDiagnostic | null {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(LAST_RUNTIME_ERROR_KEY) ?? 'null') as RuntimeErrorDiagnostic | null;
    return parsed?.at && parsed.path && parsed.message ? parsed : null;
  } catch {
    return null;
  }
}

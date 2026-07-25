import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared loading/error boilerplate for a page's initial data fetch: runs
 * `load` once on mount, exposes `loading`/`error`, and a `reload(force?)`
 * callback for pull-to-refresh and retry buttons. The page's own `load`
 * function still owns its actual fetch logic (Promise.all, setting other
 * page-local state, deriving a specific error message for a known failure,
 * etc.) -- this hook only owns the try/catch/finally + loading/error
 * wrapper that was previously hand-copied into most pages.
 */
export function useAsyncLoad(load: (force?: boolean) => Promise<void>, fallbackErrorMessage: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (force?: boolean) => {
    setError(null);
    try {
      await loadRef.current(force);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : fallbackErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [fallbackErrorMessage]);

  useEffect(() => { void run(); }, [run]);

  return { loading, setLoading, error, setError, reload: run };
}

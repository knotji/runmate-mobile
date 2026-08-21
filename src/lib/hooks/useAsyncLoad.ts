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
  // `loading` is only ever true for the very first run (existing pages rely on
  // this to gate a one-time full-page skeleton, not a spinner on every
  // reload()). `refreshing` is additive: true for any run after the first, so
  // a page can opt into showing "Try Again"/pull-to-refresh feedback without
  // changing `loading`'s established meaning for every other consumer.
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const hasLoadedOnceRef = useRef(false);
  // Guards against a stale, slower call's result overwriting a newer call's
  // result when reload() is invoked again (e.g. a second pull-to-refresh)
  // before the first one has resolved.
  const generationRef = useRef(0);

  const run = useCallback(async (force?: boolean) => {
    const generation = ++generationRef.current;
    if (hasLoadedOnceRef.current) setRefreshing(true);
    setError(null);
    try {
      await loadRef.current(force);
      if (generation !== generationRef.current) return;
    } catch (failure) {
      if (generation !== generationRef.current) return;
      setError(failure instanceof Error ? failure.message : fallbackErrorMessage);
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
        setRefreshing(false);
        hasLoadedOnceRef.current = true;
      }
    }
  }, [fallbackErrorMessage]);

  useEffect(() => { void run(); }, [run]);

  return { loading, setLoading, refreshing, error, setError, reload: run };
}

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsyncLoad } from '@/lib/hooks/useAsyncLoad';

describe('useAsyncLoad', () => {
  it('starts loading, then clears loading on success', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAsyncLoad(load, 'fallback'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('sets error to the thrown Error message', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Specific failure'));
    const { result } = renderHook(() => useAsyncLoad(load, 'fallback'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Specific failure');
  });

  it('falls back to the provided message when the thrown value is not an Error', async () => {
    const load = vi.fn().mockRejectedValue('not an error object');
    const { result } = renderHook(() => useAsyncLoad(load, 'fallback message'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('fallback message');
  });

  it('reload() re-runs load, clears a previous error, and forwards the force flag', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAsyncLoad(load, 'fallback'));

    await waitFor(() => expect(result.current.error).toBe('first failure'));

    await act(async () => { await result.current.reload(true); });

    expect(result.current.error).toBeNull();
    expect(load).toHaveBeenLastCalledWith(true);
  });

  it('does not set `loading` again on reload(), but exposes `refreshing` so a page can opt into feedback', async () => {
    let resolveReload: (() => void) | null = null;
    const load = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveReload = resolve; }));
    const { result } = renderHook(() => useAsyncLoad(load, 'fallback'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.refreshing).toBe(false);

    act(() => { void result.current.reload(); });
    // `loading` (used by pages for a one-time full-page skeleton) must stay false;
    // `refreshing` becomes true so "Try Again"/pull-to-refresh can show feedback.
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.loading).toBe(false);

    await act(async () => { resolveReload?.(); await Promise.resolve(); });
    expect(result.current.refreshing).toBe(false);
  });

  it('does not let a slower, superseded reload() overwrite the result of a newer one', async () => {
    let rejectFirst: ((reason: Error) => void) | null = null;
    let resolveSecond: (() => void) | null = null;
    const load = vi.fn()
      .mockResolvedValueOnce(undefined) // initial mount load
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSecond = resolve; }));
    const { result } = renderHook(() => useAsyncLoad(load, 'fallback'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Two overlapping reloads (e.g. a double-tapped "Try Again"). The first is
    // slower and will reject; the second is faster and succeeds.
    act(() => { void result.current.reload(); });
    act(() => { void result.current.reload(); });

    await act(async () => { resolveSecond?.(); await Promise.resolve(); });
    expect(result.current.error).toBeNull();
    expect(result.current.refreshing).toBe(false);

    // The slower, now-stale first call finally rejects — it must not clobber
    // the newer, successful result that already landed.
    await act(async () => { rejectFirst?.(new Error('stale failure')); await Promise.resolve(); });
    expect(result.current.error).toBeNull();
  });
});

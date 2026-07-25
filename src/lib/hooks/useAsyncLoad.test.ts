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
});

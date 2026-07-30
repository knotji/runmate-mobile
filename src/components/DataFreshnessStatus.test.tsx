import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataFreshnessStatus } from './DataFreshnessStatus';

describe('DataFreshnessStatus', () => {
  it('offers an accessible retry only for stale or fallback data', () => {
    const retry = vi.fn();
    const { rerender } = render(<DataFreshnessStatus status="fresh" detail="Updated just now" onRetry={retry} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<DataFreshnessStatus status="fallback" label="Saved Data" detail="Refresh unavailable" onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saved Data: retry refresh' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

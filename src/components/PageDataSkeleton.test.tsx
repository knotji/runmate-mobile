import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageDataSkeleton } from './PageDataSkeleton';

describe('PageDataSkeleton', () => {
  it('renders an accessible structured loading state without an Ionic spinner', () => {
    const { container } = render(<PageDataSkeleton variant="summary" label="Building Your Summary" />);
    expect(screen.getByRole('status', { name: 'Building Your Summary' })).toBeInTheDocument();
    expect(container.querySelectorAll('.page-data-skeleton-block')).toHaveLength(4);
    expect(container.querySelector('ion-spinner')).not.toBeInTheDocument();
  });
});

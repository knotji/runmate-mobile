import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageDataSkeleton, type PageDataSkeletonVariant } from './PageDataSkeleton';

describe('PageDataSkeleton', () => {
  it('renders an accessible structured loading state without an Ionic spinner', () => {
    const { container } = render(<PageDataSkeleton variant="summary" label="Building Your Summary" />);
    expect(screen.getByRole('status', { name: 'Building Your Summary' })).toBeInTheDocument();
    expect(container.querySelectorAll('.page-data-skeleton-block')).toHaveLength(4);
    expect(container.querySelector('ion-spinner')).not.toBeInTheDocument();
  });

  it('keeps the Sleep Window loading layout close to the finished page', () => {
    const { container } = render(<PageDataSkeleton variant="sleep" label="Preparing Your Sleep Window" />);
    expect(screen.getByRole('status', { name: 'Preparing Your Sleep Window' })).toBeInTheDocument();
    expect(container.querySelectorAll('.page-data-skeleton-block')).toHaveLength(3);
    expect(container.querySelector('.page-data-skeleton-block.is-accent')).toBeInTheDocument();
    expect(container.querySelector('ion-spinner')).not.toBeInTheDocument();
  });

  it('reserves chart, insight, and history space for Recovery Trends', () => {
    const { container } = render(<PageDataSkeleton variant="trends" label="Building Your Recovery Trends" />);
    expect(screen.getByRole('status', { name: 'Building Your Recovery Trends' })).toBeInTheDocument();
    expect(container.querySelectorAll('.page-data-skeleton-block')).toHaveLength(3);
    expect(container.querySelector('.page-data-skeleton-chart')).toBeInTheDocument();
    expect(container.querySelector('ion-spinner')).not.toBeInTheDocument();
  });

  it.each<PageDataSkeletonVariant>(['activity', 'coach', 'detail', 'health', 'nutrition', 'notifications', 'profile', 'race', 'recovery', 'sleep', 'summary', 'trends'])('renders the %s page loader without a spinner', (variant) => {
    const { container } = render(<PageDataSkeleton variant={variant} label={`Loading ${variant}`} />);
    expect(container.querySelector('.page-data-skeleton-block')).toBeInTheDocument();
    expect(container.querySelector('ion-spinner')).not.toBeInTheDocument();
  });
});

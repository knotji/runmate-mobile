import './PageDataSkeleton.css';

type PageDataSkeletonProps = {
  variant: 'coach' | 'race' | 'summary' | 'profile';
  label: string;
};

const layouts = {
  coach: [1, 3],
  race: [3, 4, 4],
  summary: [3, 2, 2, 3],
  profile: [2, 3, 1],
} as const;

export function PageDataSkeleton({ variant, label }: PageDataSkeletonProps) {
  return <section className={`page-data-skeleton page-data-skeleton-${variant}`} role="status" aria-live="polite" aria-label={label}>
    <p className="page-data-skeleton-status"><span aria-hidden="true" />{label}</p>
    {layouts[variant].map((metricCount, blockIndex) => <div className={`page-data-skeleton-block${variant === 'race' && blockIndex === 0 ? ' is-accent' : ''}`} key={`${variant}-${blockIndex}`} aria-hidden="true">
      <i className="page-data-skeleton-kicker" />
      <i className="page-data-skeleton-title" />
      {metricCount > 1 && <div className="page-data-skeleton-metrics">
        {Array.from({ length: metricCount }).map((_, metricIndex) => <i key={metricIndex} />)}
      </div>}
      {variant === 'coach' && blockIndex === 1 && <div className="page-data-skeleton-rows">{Array.from({ length: 4 }).map((_, rowIndex) => <i key={rowIndex} />)}</div>}
      {variant === 'race' && blockIndex === 2 && <div className="page-data-skeleton-rows">{Array.from({ length: 4 }).map((_, rowIndex) => <i key={rowIndex} />)}</div>}
    </div>)}
  </section>;
}

import './PageDataSkeleton.css';

export type PageDataSkeletonVariant = 'activity' | 'coach' | 'detail' | 'health' | 'nutrition' | 'notifications' | 'profile' | 'race' | 'recovery' | 'sleep' | 'summary' | 'trends';

type PageDataSkeletonProps = {
  variant: PageDataSkeletonVariant;
  label: string;
};

type SkeletonBlock = { metrics?: number; accent?: boolean; rows?: number; chart?: boolean };

const layouts: Record<PageDataSkeletonVariant, readonly SkeletonBlock[]> = {
  activity: [{ metrics: 3 }, { rows: 5 }],
  coach: [{}, { metrics: 3, rows: 4 }],
  detail: [{}, { metrics: 4 }, { rows: 3 }],
  health: [{}, { rows: 4 }, { rows: 3 }],
  nutrition: [{ metrics: 3 }, { metrics: 4 }, { chart: true }, { metrics: 2 }],
  notifications: [{}, { rows: 4 }],
  profile: [{ metrics: 2 }, { metrics: 3 }, {}],
  race: [{ metrics: 3, accent: true }, { metrics: 4 }, { metrics: 4, rows: 4 }],
  recovery: [{ metrics: 3, accent: true }, {}, {}],
  sleep: [{ accent: true }, { metrics: 2 }, { metrics: 2 }],
  summary: [{ metrics: 3 }, { metrics: 2 }, { metrics: 2 }, { metrics: 3 }],
  trends: [{ chart: true }, { rows: 3 }, { rows: 4 }],
};

export function PageDataSkeleton({ variant, label }: PageDataSkeletonProps) {
  return <section className={`page-data-skeleton page-data-skeleton-${variant}`} role="status" aria-live="polite" aria-label={label}>
    <p className="page-data-skeleton-status"><span aria-hidden="true" />{label}</p>
    {layouts[variant].map((block, blockIndex) => <div className={`page-data-skeleton-block${block.accent ? ' is-accent' : ''}`} key={`${variant}-${blockIndex}`} aria-hidden="true">
      <i className="page-data-skeleton-kicker" />
      <i className="page-data-skeleton-title" />
      {block.metrics && block.metrics > 1 && <div className="page-data-skeleton-metrics">
        {Array.from({ length: block.metrics }).map((_, metricIndex) => <i key={metricIndex} />)}
      </div>}
      {block.chart && <div className="page-data-skeleton-chart">
        {Array.from({ length: 4 }).map((_, lineIndex) => <i key={lineIndex} />)}
      </div>}
      {block.rows && <div className="page-data-skeleton-rows">{Array.from({ length: block.rows }).map((_, rowIndex) => <i key={rowIndex} />)}</div>}
    </div>)}
  </section>;
}

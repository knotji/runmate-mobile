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
  if (variant === 'recovery') {
    return <section className="page-data-skeleton page-data-skeleton-recovery" role="status" aria-live="polite" aria-label={label}>
      <p className="page-data-skeleton-status recovery-skeleton-status"><span aria-hidden="true" />{label}</p>
      <div className="page-data-skeleton-block recovery-skeleton-hero" aria-hidden="true">
        <div className="recovery-skeleton-readiness">
          <i className="recovery-skeleton-ring recovery-skeleton-ring-large" />
          <div className="recovery-skeleton-copy">
            <i className="page-data-skeleton-kicker" />
            <i className="page-data-skeleton-title" />
            <i className="recovery-skeleton-line" />
            <i className="recovery-skeleton-line is-short" />
          </div>
        </div>
        <div className="recovery-skeleton-support">
          <div><i className="recovery-skeleton-ring" /><i className="recovery-skeleton-label" /></div>
          <div><i className="recovery-skeleton-ring is-strain" /><i className="recovery-skeleton-label" /></div>
        </div>
      </div>
      <div className="page-data-skeleton-block recovery-skeleton-focus" aria-hidden="true">
        <div className="recovery-skeleton-heading"><i className="page-data-skeleton-kicker" /><i className="recovery-skeleton-pill" /></div>
        <i className="page-data-skeleton-title" />
        <div className="recovery-skeleton-guidance"><i /><i /></div>
        <i className="recovery-skeleton-footer" />
      </div>
      <div className="recovery-skeleton-tonight" aria-hidden="true">
        <i className="page-data-skeleton-kicker" />
        <i className="page-data-skeleton-title" />
        <div className="page-data-skeleton-block recovery-skeleton-sleep-card">
          <i className="recovery-skeleton-icon" />
          <div><i className="recovery-skeleton-label" /><i className="recovery-skeleton-sleep-title" /><i className="recovery-skeleton-line" /></div>
          <i className="recovery-skeleton-action" />
        </div>
      </div>
    </section>;
  }

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

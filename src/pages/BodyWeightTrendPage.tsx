import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, barbellOutline, informationCircleOutline, scaleOutline, trendingDownOutline, trendingUpOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { todayBangkokDateKey } from '@/lib/date';
import { bodyWeightTrendHistoryOptions, buildBodyWeightTrend, type BodyWeightTrend, type BodyWeightTrendLog, type BodyWeightTrendPoint } from '@/lib/bodyWeightTrend';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { loadBodyWeightTrendStartupSnapshot, saveBodyWeightTrendStartupSnapshot } from '@/lib/bodyWeightTrendStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { navigateBackOr } from '@/lib/navigationBack';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { DataFreshnessStatus } from '@/components/DataFreshnessStatus';
import './BodyWeightTrendPage.css';

const BodyWeightTrendPage: React.FC = () => {
  const history = useHistory();
  const [days, setDays] = useState<7 | 30>(30);
  const [startupTrends] = useState(() => loadBodyWeightTrendStartupSnapshot());
  const [items, setItems] = useState<LocalHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(() => startupTrends === null);
  const [error, setError] = useState<string | null>(null);
  const activeLoadRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (activeLoadRef.current) return activeLoadRef.current;
    const operation = (async () => {
      setLoading(true);
      setError(null);
      const result = await measurePerformanceDiagnostic(
        'body_weight_trend',
        () => loadHistoryItems(['body'], bodyWeightTrendHistoryOptions()),
        (value) => ({
          status: value.ok ? 'success' : 'failed',
          detail: value.ok ? `${value.items.length} body readings prepared` : value.error,
        }),
      );
      if (result.ok) {
        const today = todayBangkokDateKey();
        setItems(result.items);
        saveBodyWeightTrendStartupSnapshot({
          sevenDay: buildBodyWeightTrend(result.items, 7, today),
          thirtyDay: buildBodyWeightTrend(result.items, 30, today),
        });
      } else {
        setError(result.error);
      }
      setLoading(false);
    })().finally(() => { activeLoadRef.current = null; });
    activeLoadRef.current = operation;
    return operation;
  }, []);

  useEffect(() => { void load(); }, [load]);
  const trend = useMemo(() => items
    ? buildBodyWeightTrend(items, days, todayBangkokDateKey())
    : days === 7 ? startupTrends?.sevenDay ?? null : startupTrends?.thirtyDay ?? null, [items, days, startupTrends]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="body-trend-header"><IonToolbar>
      <button type="button" className="body-trend-back" aria-label="Back To Health" onClick={() => navigateBackOr(history, '/tabs/health')}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Body Weight Trend</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="body-trend-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="body-trend-shell">
        <header className="body-trend-heading"><p>Your Body</p><h1>See How Your Weight Is Trending</h1><span>Weigh-ins synced from Health Connect, over time.</span></header>
        <div className="body-trend-range" role="group" aria-label="Trend range">
          <button type="button" className={days === 7 ? 'active' : ''} aria-pressed={days === 7} onClick={() => setDays(7)}>7 Days</button>
          <button type="button" className={days === 30 ? 'active' : ''} aria-pressed={days === 30} onClick={() => setDays(30)}>30 Days</button>
        </div>
        {loading && !trend && <PageDataSkeleton variant="trends" label="Building Your Body Weight Trend" />}
        {trend && loading && <DataFreshnessStatus status="refreshing" detail="Refreshing body-weight readings…" />}
        {trend && !loading && error && <DataFreshnessStatus status="fallback" label="Saved Data" detail="Refresh unavailable · Showing your last loaded weight trend" onRetry={() => void load()} variant="panel" />}
        {!loading && error && !trend && <PageState kind="error" title="Trend Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="body-trend-state" />}
        {trend && trend.logs.length === 0 && (
          <PageState kind="empty" icon={scaleOutline} title="No Weigh-Ins Yet" detail="WholeMate loaded this range successfully, but found no weight readings. Check Health Connect access or add Body Weight in Profile & Settings." actionLabel="Check Health Connect" onAction={() => history.push('/health-connect')} className="body-trend-state" />
        )}
        {trend && trend.logs.length > 0 && <>
          <section className="body-trend-chart-card" aria-labelledby="body-trend-chart-heading">
            <div className="body-trend-section-heading"><div><p>Last {days} Days</p><h2 id="body-trend-chart-heading">Body Weight At A Glance</h2></div><Coverage points={trend.points} /></div>
            <BodyWeightSummary trend={trend} />
            <BodyWeightChart points={trend.points} />
          </section>

          <section className={`body-trend-insight-card direction-${trend.insight.direction}`} aria-labelledby="body-trend-insight-heading">
            <div className="body-trend-insight-icon"><IonIcon icon={trend.insight.direction === 'down' ? trendingDownOutline : trend.insight.direction === 'up' ? trendingUpOutline : informationCircleOutline} /></div>
            <div><p>What Is Changing</p><h2 id="body-trend-insight-heading">{trend.insight.title}</h2><span>{trend.insight.summary}</span></div>
          </section>

          <BodyWeightHistory logs={trend.logs} />
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function BodyWeightSummary({ trend }: { trend: BodyWeightTrend }) {
  const change = trend.changeKg == null ? '—' : `${trend.changeKg > 0 ? '+' : ''}${trend.changeKg.toFixed(1)} kg`;
  return <div className="body-trend-summary" aria-label="Body weight summary">
    <div><span>Latest</span><strong>{trend.latestWeightKg?.toFixed(1)} <small>kg</small></strong></div>
    <div><span>Change</span><strong className={trend.changeKg == null ? '' : trend.changeKg > 0 ? 'change-up' : trend.changeKg < 0 ? 'change-down' : ''}>{change}</strong></div>
    <div><span>Readings</span><strong>{trend.logs.length}</strong></div>
  </div>;
}

function Coverage({ points }: { points: BodyWeightTrendPoint[] }) {
  const count = points.filter((point) => point.weightKg != null).length;
  return <span className="body-trend-coverage">{count}/{points.length} Days Logged</span>;
}

function BodyWeightChart({ points }: { points: BodyWeightTrendPoint[] }) {
  const width = 320; const height = 140; const left = 30; const right = 8; const top = 12; const bottom = 22;
  const values = points.map((point) => point.weightKg).filter((value): value is number => value != null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const padding = Math.max(0.5, (max - min) * 0.15);
  const scaleMin = min - padding;
  const scaleMax = max + padding;
  const x = (index: number) => left + index * ((width - left - right) / Math.max(1, points.length - 1));
  const y = (value: number) => top + (scaleMax - value) * ((height - top - bottom) / Math.max(0.01, scaleMax - scaleMin));
  const segments: string[] = []; let current = '';
  points.forEach((point, index) => {
    if (point.weightKg == null) { if (current) segments.push(current); current = ''; return; }
    current += `${current ? ' L' : 'M'} ${x(index).toFixed(1)} ${y(point.weightKg).toFixed(1)}`;
  });
  if (current) segments.push(current);
  const labels = points.length <= 7 ? [0, Math.floor(points.length / 2), points.length - 1] : [0, 9, 19, points.length - 1];
  const gridValues = [scaleMin, (scaleMin + scaleMax) / 2, scaleMax];
  let latestIndex = -1;
  points.forEach((point, index) => { if (point.weightKg != null) latestIndex = index; });

  return <div className="body-trend-chart-wrap">
    <svg className="body-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="body-trend-chart-title body-trend-chart-description">
      <title id="body-trend-chart-title">Body weight trend chart</title>
      <desc id="body-trend-chart-description">{values.length} weight readings in this window, from {min.toFixed(1)} to {max.toFixed(1)} kilograms.</desc>
      {gridValues.map((value) => <g key={value}>
        <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="body-trend-grid-line" />
        <text x={left - 4} y={y(value) + 3} textAnchor="end" className="body-trend-grid-label">{value.toFixed(1)}</text>
      </g>)}
      {segments.map((path, index) => <path key={index} d={path} className="body-trend-line" />)}
      {points.map((point, index) => point.weightKg == null ? null : (
        <circle key={point.date} cx={x(index)} cy={y(point.weightKg)} r={index === latestIndex ? 4 : 3} className={index === latestIndex ? 'body-trend-dot latest' : 'body-trend-dot'}>
          <title>{formatChartDate(point.date)}: {point.weightKg.toFixed(1)} kg</title>
        </circle>
      ))}
      {labels.map((index) => <text key={index} x={x(index)} y={height - 4} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{formatChartDate(points[index]?.date)}</text>)}
    </svg>
  </div>;
}

function BodyWeightHistory({ logs }: { logs: BodyWeightTrendLog[] }) {
  return <section className="body-trend-history">
    <details className="body-trend-history-disclosure">
      <summary><div><p>Daily Detail</p><h2>Weigh-Ins In This Window</h2></div><span>{logs.length} {logs.length === 1 ? 'Reading' : 'Readings'}</span></summary>
      <div className="body-trend-history-list">{logs.map((log) => <BodyWeightRow key={log.date} log={log} />)}</div>
    </details>
  </section>;
}

function BodyWeightRow({ log }: { log: BodyWeightTrendLog }) {
  return <div className="body-trend-history-row">
    <div><strong>{formatRowDate(log.date)}</strong>{log.bodyFatPercent != null && <span><IonIcon icon={barbellOutline} />{log.bodyFatPercent}% Body Fat</span>}</div>
    <div className="body-trend-history-weight"><strong>{log.weightKg}</strong><small>kg</small></div>
  </div>;
}

function formatChartDate(date?: string): string { if (!date) return ''; return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }
function formatRowDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }

export default BodyWeightTrendPage;

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, barbellOutline, informationCircleOutline, scaleOutline, trendingDownOutline, trendingUpOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { todayBangkokDateKey } from '@/lib/date';
import { buildBodyWeightTrend, type BodyWeightTrendLog, type BodyWeightTrendPoint } from '@/lib/bodyWeightTrend';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import './BodyWeightTrendPage.css';

const BodyWeightTrendPage: React.FC = () => {
  const history = useHistory();
  const [days, setDays] = useState<7 | 30>(30);
  const [items, setItems] = useState<LocalHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await loadHistoryItems(['body']);
      if (!result.ok) throw new Error(result.error ?? 'Could Not Load Body Weight History.');
      setItems(result.items);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could Not Load Body Weight Trend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const trend = useMemo(() => items ? buildBodyWeightTrend(items, days, todayBangkokDateKey()) : null, [items, days]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="body-trend-header"><IonToolbar>
      <button type="button" className="body-trend-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
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
        {loading && <PageDataSkeleton variant="trends" label="Building Your Body Weight Trend" />}
        {!loading && error && <PageState kind="error" title="Trend Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="body-trend-state" />}
        {!loading && !error && trend && trend.logs.length === 0 && (
          <PageState kind="empty" icon={scaleOutline} title="No Weigh-Ins Yet" detail="Connect a smart scale through Health Connect, or log your Body Weight in Profile & Settings, to build a trend here." className="body-trend-state" />
        )}
        {!loading && !error && trend && trend.logs.length > 0 && <>
          <section className="body-trend-chart-card" aria-labelledby="body-trend-chart-heading">
            <div className="body-trend-section-heading"><div><p>Last {days} Days</p><h2 id="body-trend-chart-heading">Body Weight At A Glance</h2></div><Coverage points={trend.points} /></div>
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

  return <div className="body-trend-chart-wrap">
    <svg className="body-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Body weight trend chart">
      {gridValues.map((value) => <g key={value}>
        <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="body-trend-grid-line" />
        <text x={left - 4} y={y(value) + 3} textAnchor="end" className="body-trend-grid-label">{value.toFixed(1)}</text>
      </g>)}
      {segments.map((path, index) => <path key={index} d={path} className="body-trend-line" />)}
      {points.map((point, index) => point.weightKg == null ? null : (
        <circle key={point.date} cx={x(index)} cy={y(point.weightKg)} r={3} className="body-trend-dot" />
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

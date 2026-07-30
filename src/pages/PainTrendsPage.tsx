import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { alertCircleOutline, arrowBackOutline, checkmarkCircleOutline, informationCircleOutline, trendingDownOutline, trendingUpOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { todayBangkokDateKey } from '@/lib/date';
import { buildPainTrend, type PainTrendLog, type PainTrendPoint } from '@/lib/painTrends';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { loadPainTrendsStartupSnapshot, savePainTrendsStartupSnapshot } from '@/lib/painTrendsStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { DataFreshnessStatus } from '@/components/DataFreshnessStatus';
import './PainTrendsPage.css';

const PainTrendsPage: React.FC = () => {
  const history = useHistory();
  const [days, setDays] = useState<7 | 30>(7);
  const [startupTrends] = useState(() => loadPainTrendsStartupSnapshot());
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
        'pain_trends',
        () => loadHistoryItems(['pain']),
        (value) => ({
          status: value.ok ? 'success' : 'failed',
          detail: value.ok ? `${value.items.length} pain reports prepared` : value.error,
        }),
      );
      if (result.ok) {
        const today = todayBangkokDateKey();
        setItems(result.items);
        savePainTrendsStartupSnapshot({
          sevenDay: buildPainTrend(result.items, 7, today),
          thirtyDay: buildPainTrend(result.items, 30, today),
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
    ? buildPainTrend(items, days, todayBangkokDateKey())
    : days === 7 ? startupTrends?.sevenDay ?? null : startupTrends?.thirtyDay ?? null, [items, days, startupTrends]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="pain-trends-header"><IonToolbar>
      <button type="button" className="pain-trends-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Pain & Injury Trend</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="pain-trends-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="pain-trends-shell">
        <header className="pain-trends-heading"><p>Your Body</p><h1>See How Pain Is Trending</h1><span>Every Pain and Injury report you have logged, over time.</span></header>
        <div className="pain-range" role="group" aria-label="Trend range">
          <button type="button" className={days === 7 ? 'active' : ''} aria-pressed={days === 7} onClick={() => setDays(7)}>7 Days</button>
          <button type="button" className={days === 30 ? 'active' : ''} aria-pressed={days === 30} onClick={() => setDays(30)}>30 Days</button>
        </div>
        {loading && !trend && <PageDataSkeleton variant="trends" label="Building Your Pain Trend" />}
        {trend && loading && <DataFreshnessStatus status="refreshing" detail="Refreshing pain and injury reports…" />}
        {trend && !loading && error && <DataFreshnessStatus status="fallback" label="Saved Data" detail="Refresh unavailable · Showing your last loaded pain trend" onRetry={() => void load()} variant="panel" />}
        {!loading && error && !trend && <PageState kind="error" title="Trend Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="pain-trends-state" />}
        {trend && trend.logs.length === 0 && <PageState kind="empty" icon={checkmarkCircleOutline} title="No Pain Reports In This Range" detail="RunMate loaded this range successfully and found no pain or injury reports." className="pain-trends-state" />}
        {trend && trend.logs.length > 0 && <>
          <section className="pain-chart-card" aria-labelledby="pain-chart-heading">
            <div className="pain-section-heading"><div><p>Last {days} Days</p><h2 id="pain-chart-heading">Pain Level At A Glance</h2></div><Coverage points={trend.points} /></div>
            <PainChart points={trend.points} />
          </section>

          <section className={`pain-insight-card direction-${trend.insight.direction}`} aria-labelledby="pain-insight-heading">
            <div className="pain-insight-icon"><IonIcon icon={trend.insight.direction === 'improving' ? trendingDownOutline : trend.insight.direction === 'worsening' ? trendingUpOutline : informationCircleOutline} /></div>
            <div><p>What Is Changing</p><h2 id="pain-insight-heading">{trend.insight.title}</h2><span>{trend.insight.summary}</span></div>
          </section>

          {trend.hasActivePain && (
            <p className="pain-active-note"><IonIcon icon={alertCircleOutline} />Active pain currently overrides training guidance in Today's Plan and AI Coach.</p>
          )}

          <PainHistory logs={trend.logs} />
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function Coverage({ points }: { points: PainTrendPoint[] }) {
  const count = points.filter((point) => point.painLevel != null).length;
  return <span className="pain-coverage">{count}/{points.length} Days Logged</span>;
}

function PainChart({ points }: { points: PainTrendPoint[] }) {
  const width = 320; const height = 140; const left = 18; const right = 8; const top = 12; const bottom = 22;
  const x = (index: number) => left + index * ((width - left - right) / Math.max(1, points.length - 1));
  const y = (value: number) => top + (10 - value) * ((height - top - bottom) / 10);
  const segments: string[] = []; let current = '';
  points.forEach((point, index) => {
    if (point.painLevel == null) { if (current) segments.push(current); current = ''; return; }
    current += `${current ? ' L' : 'M'} ${x(index).toFixed(1)} ${y(point.painLevel).toFixed(1)}`;
  });
  if (current) segments.push(current);
  const labels = points.length <= 7 ? [0, Math.floor(points.length / 2), points.length - 1] : [0, 9, 19, points.length - 1];

  return <div className="pain-chart-wrap">
    <svg className="pain-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="pain-chart-title pain-chart-description">
      <title id="pain-chart-title">Pain level trend chart</title>
      <desc id="pain-chart-description">{points.filter((point) => point.painLevel != null).length} logged days in this window. Pain is scored from zero to ten.</desc>
      {[0, 5, 10].map((value) => <line key={value} x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="pain-grid-line" />)}
      {segments.map((path, index) => <path key={index} d={path} className="pain-line" />)}
      {points.map((point, index) => point.painLevel == null ? null : (
        <circle key={point.date} cx={x(index)} cy={y(point.painLevel)} r={3} className={`pain-dot ${point.status === 'resolved' ? 'resolved' : 'active'}`}>
          <title>{formatChartDate(point.date)}: pain {point.painLevel} of 10, {point.status}</title>
        </circle>
      ))}
      {labels.map((index) => <text key={index} x={x(index)} y={height - 4} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{formatChartDate(points[index]?.date)}</text>)}
    </svg>
    <div className="pain-legend"><span className="active">Active</span><span className="resolved">Resolved</span></div>
  </div>;
}

function PainHistory({ logs }: { logs: PainTrendLog[] }) {
  return <section className="pain-history">
    <details className="pain-history-disclosure">
      <summary><div><p>Daily Detail</p><h2>Reports In This Window</h2></div><span>{logs.length} {logs.length === 1 ? 'Report' : 'Reports'}</span></summary>
      {logs.length === 0 ? (
        <p className="pain-history-empty"><IonIcon icon={checkmarkCircleOutline} />No Pain or Injury reports in this window.</p>
      ) : (
        <div className="pain-history-list">{logs.map((log) => <PainRow key={`${log.date}-${log.painLocation}`} log={log} />)}</div>
      )}
    </details>
  </section>;
}

function PainRow({ log }: { log: PainTrendLog }) {
  return <div className={`pain-history-row status-${log.status}`}>
    <div><strong>{formatRowDate(log.date)}</strong><span>{log.painLocation}{log.painSide !== 'unknown' ? ` (${log.painSide})` : ''}</span></div>
    <div className="pain-history-level"><strong>{log.painLevel}</strong><small>/10</small></div>
    <span className={`pain-history-status status-${log.status}`}>{log.status === 'resolved' ? 'Resolved' : 'Active'}</span>
  </div>;
}

function formatChartDate(date?: string): string { if (!date) return ''; return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }
function formatRowDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }

export default PainTrendsPage;

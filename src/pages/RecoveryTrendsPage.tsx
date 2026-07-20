import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, informationCircleOutline, trendingDownOutline, trendingUpOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { todayBangkokDateKey } from '@/lib/date';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { buildRecoveryTrend, type RecoveryTrendPoint } from '@/lib/recoveryTrends';
import { syncTodayHealth } from '@/lib/healthSyncService';
import type { LocalHistoryItem } from '@/lib/localHistory';
import './RecoveryTrendsPage.css';

const RecoveryTrendsPage: React.FC = () => {
  const history = useHistory();
  const [days, setDays] = useState<7 | 30>(7);
  const [source, setSource] = useState<{ items: LocalHistoryItem[]; profile: Record<string, unknown> | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sync = false) => {
    setError(null);
    try {
      if (sync) await syncTodayHealth(true);
      const [historyResult, profileResult] = await Promise.all([
        loadHistoryItems(['sleep', 'workout', 'strength']),
        loadProfileFromSupabase(),
      ]);
      if (!historyResult.ok) throw new Error(historyResult.error ?? 'Could Not Load Recovery History.');
      setSource({ items: historyResult.items, profile: profileResult.ok ? profileResult.profile ?? null : null });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could Not Load Recovery Trends.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const trend = useMemo(() => source ? buildRecoveryTrend(source.items, source.profile, days, todayBangkokDateKey()) : null, [source, days]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(true); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="recovery-trends-header"><IonToolbar>
      <button type="button" className="recovery-trends-back" aria-label="Back To Recovery" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Recovery Trends</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="recovery-trends-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="recovery-trends-shell">
        <header className="recovery-trends-heading"><p>Your Baseline</p><h1>See What Is Changing</h1><span>Recovery, Sleep, and Strain from the records available in RunMate.</span></header>
        <div className="recovery-range" role="group" aria-label="Trend range">
          <button type="button" className={days === 7 ? 'active' : ''} aria-pressed={days === 7} onClick={() => setDays(7)}>7 Days</button>
          <button type="button" className={days === 30 ? 'active' : ''} aria-pressed={days === 30} onClick={() => setDays(30)}>30 Days</button>
        </div>
        {loading && <div className="recovery-trends-state"><IonSpinner name="crescent" /><p>Building Your Trends…</p></div>}
        {!loading && error && <div className="recovery-trends-state"><p>{error}</p><button type="button" onClick={() => void load()}>Try Again</button></div>}
        {!loading && trend && <>
          <section className="trend-chart-card" aria-labelledby="trend-chart-heading">
            <div className="trend-section-heading"><div><p>Last {days} Days</p><h2 id="trend-chart-heading">Recovery At A Glance</h2></div><Coverage points={trend.points} /></div>
            <TrendChart points={trend.points} compact={days === 30} />
            <div className="trend-legend"><span className="recovery">Recovery</span><span className="sleep">Sleep Score</span><span className="strain">Strain</span></div>
          </section>

          <section className={`trend-insight-card direction-${trend.insight.direction}`} aria-labelledby="trend-insight-heading">
            <div className="trend-insight-icon"><IonIcon icon={trend.insight.direction === 'up' ? trendingUpOutline : trend.insight.direction === 'down' ? trendingDownOutline : informationCircleOutline} /></div>
            <div><p>Why Your Score Changed</p><h2 id="trend-insight-heading">{trend.insight.title}</h2><span>{trend.insight.summary}</span></div>
            {trend.insight.factors.length > 0 && <div className="trend-factor-list">{trend.insight.factors.map((factor) => <div key={factor}><span aria-hidden="true" />{factor}</div>)}</div>}
          </section>

          <TrendHistory points={trend.points} days={days} />
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function TrendChart({ points, compact }: { points: RecoveryTrendPoint[]; compact: boolean }) {
  const width = 320; const height = 154; const left = 14; const right = 8; const top = 12; const bottom = 24;
  const x = (index: number) => left + index * ((width - left - right) / Math.max(1, points.length - 1));
  const y = (value: number) => top + (100 - value) * ((height - top - bottom) / 100);
  const paths = (key: 'recovery' | 'sleep' | 'strain') => {
    const segments: string[] = []; let current = '';
    points.forEach((point, index) => {
      const raw = point[key]; const value = key === 'strain' && raw != null ? raw / 21 * 100 : raw;
      if (value == null) { if (current) segments.push(current); current = ''; return; }
      current += `${current ? ' L' : 'M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
    });
    if (current) segments.push(current);
    return segments;
  };
  const labels = points.length <= 7 ? [0, Math.floor(points.length / 2), points.length - 1] : [0, 9, 19, points.length - 1];
  return <div className="trend-chart-wrap">
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recovery, Sleep, and Strain trend chart">
      {[25, 50, 75].map((value) => <line key={value} x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="trend-grid-line" />)}
      {(['recovery', 'sleep', 'strain'] as const).flatMap((key) => paths(key).map((path, index) => <path key={`${key}-${index}`} d={path} className={`trend-line trend-line-${key}`} />))}
      {(['recovery', 'sleep', 'strain'] as const).flatMap((key) => points.map((point, index) => {
        const raw = point[key]; const value = key === 'strain' && raw != null ? raw / 21 * 100 : raw;
        const isLatestValue = !points.slice(index + 1).some((candidate) => candidate[key] != null);
        return value == null || (compact && !isLatestValue) ? null : <circle key={`${key}-${point.date}`} cx={x(index)} cy={y(value)} r={key === 'recovery' ? 3.2 : 2.4} className={`trend-dot trend-dot-${key}`} />;
      }))}
      {labels.map((index) => <text key={index} x={x(index)} y={height - 4} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{formatChartDate(points[index]?.date)}</text>)}
    </svg>
  </div>;
}

function Coverage({ points }: { points: RecoveryTrendPoint[] }) { const count = points.filter((point) => point.recovery != null).length; return <span className="trend-coverage">{count}/{points.length} Nights</span>; }
function TrendHistory({ points, days }: { points: RecoveryTrendPoint[]; days: 7 | 30 }) {
  const visiblePoints = points.slice().reverse().filter(hasAnyMetric).slice(0, days === 7 ? 7 : 10);
  return <section className="trend-history">
    <details className="trend-history-disclosure">
      <summary><div><p>Daily Detail</p><h2>Recent Scores</h2></div><span>{visiblePoints.length} Days</span></summary>
      <div className="trend-history-columns" aria-hidden="true"><span>Date</span><span>Recovery</span><span>Sleep</span><span>Strain</span></div>
      <div className="trend-history-list">{visiblePoints.map((point) => <TrendRow key={point.date} point={point} />)}</div>
      <p className="trend-method-note"><IonIcon icon={informationCircleOutline} />Historical Recovery uses available physiological signals and personal-baseline weighting. Sleep shows the recorded Sleep Score. Missing data stays blank.</p>
    </details>
  </section>;
}
function TrendRow({ point }: { point: RecoveryTrendPoint }) { return <div className="trend-history-row"><div><strong>{formatRowDate(point.date)}</strong><span>{point.state === 'calibrating' ? 'Calibrating' : point.state === 'scored' ? 'Scored' : 'No Recovery Score'}</span></div><Metric label="Recovery" value={point.recovery == null ? '—' : String(point.recovery)} tone="recovery" /><Metric label="Sleep" value={point.sleep == null ? '—' : String(Math.round(point.sleep))} tone="sleep" /><Metric label="Strain" value={point.strain == null ? '—' : point.strain.toFixed(1)} tone="strain" /></div>; }
function Metric({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={`trend-row-metric ${tone}`} aria-label={`${label} ${value}`}><strong>{value}</strong></div>; }
function hasAnyMetric(point: RecoveryTrendPoint): boolean { return point.recovery != null || point.sleep != null || point.strain != null; }
function formatChartDate(date?: string): string { if (!date) return ''; return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }
function formatRowDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }

export default RecoveryTrendsPage;

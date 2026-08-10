import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, cafeOutline, calendarClearOutline, chevronBackOutline, chevronForwardOutline, fitnessOutline, flameOutline, heartOutline, informationCircleOutline, partlySunnyOutline, pulseOutline, refreshOutline, thermometerOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import type { CoachContext } from '@/lib/buildCoachContext';
import { loadHistoryItems } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildRecoveryTrend } from '@/lib/recoveryTrends';
import { describeAllDayHeartRateSync, loadAllDayHeartRateStore, summarizeAllDayHeartRate, syncAllDayHeartRate, type AllDayHeartRateStore, type AllDayHeartRateSummary, type AllDayHeartRateSyncResult } from '@/lib/allDayHeartRate';
import { buildHistoricalStrainDetailInsight, buildStrainDetailInsight, loadDailyStrainCheckIn, saveDailyStrainCheckIn, type DailyStrainCheckIn, type EnvironmentContext, type StrainContributor, type StressLevel } from '@/lib/strainContext';
import { shiftDate, todayBangkokDateKey } from '@/lib/date';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { PageState } from '@/components/PageState';
import { navigateBackOr } from '@/lib/navigationBack';
import './StrainDetailPage.css';

const StrainDetailPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [items, setItems] = useState<LocalHistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => todayBangkokDateKey());
  const [heartRateStore, setHeartRateStore] = useState<AllDayHeartRateStore>(() => loadAllDayHeartRateStore());
  const [heartRateSync, setHeartRateSync] = useState<AllDayHeartRateSyncResult | null>(null);
  const [checkIn, setCheckIn] = useState<DailyStrainCheckIn>(() => loadDailyStrainCheckIn(selectedDate));
  const [loading, setLoading] = useState(true);
  const [syncingHr, setSyncingHr] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeLoad = useRef<Promise<void> | null>(null);

  const load = useCallback((force = false) => {
    if (activeLoad.current) return activeLoad.current;
    const operation = (async () => {
      setError(null);
      const [nextContext, historyResult] = await Promise.all([
        buildCoachContextFromSupabase({ force }),
        loadHistoryItems(['sleep', 'workout', 'strength'], {
          limit: 250,
          createdAfter: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        }),
      ]);
      setContext(nextContext);
      if (historyResult.ok) setItems(historyResult.items); else setError(historyResult.error);
      setHeartRateStore(loadAllDayHeartRateStore());
      setSelectedDate((current) => current > nextContext.todayDate ? nextContext.todayDate : current);
      setLoading(false);
    })().catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Could Not Load Strain Detail.');
      setLoading(false);
    }).finally(() => { activeLoad.current = null; });
    activeLoad.current = operation;
    return operation;
  }, []);

  const refreshHeartRate = useCallback(async (force = false) => {
    setSyncingHr(true);
    try {
      const result = await syncAllDayHeartRate(force);
      setHeartRateSync(result);
      setHeartRateStore(loadAllDayHeartRateStore());
    } finally {
      setSyncingHr(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void refreshHeartRate(false);
    const update = () => setHeartRateStore(loadAllDayHeartRateStore());
    window.addEventListener('runmate:all-day-heart-rate-updated', update);
    return () => window.removeEventListener('runmate:all-day-heart-rate-updated', update);
  }, [load, refreshHeartRate]);

  const trend = useMemo(() => context ? buildRecoveryTrend(items, context.profile, 7, context.todayDate).points : [], [context, items]);
  const availableDates = useMemo(() => context ? Array.from({ length: 7 }, (_, index) => shiftDate(context.todayDate, index - 6)) : [], [context]);
  const isToday = !context || selectedDate === context.todayDate;
  const heartRate = useMemo(() => summarizeAllDayHeartRate(heartRateStore, selectedDate), [heartRateStore, selectedDate]);
  const selectedTrend = useMemo(() => trend.find((point) => point.date === selectedDate) ?? null, [selectedDate, trend]);
  const selectedDateIndex = availableDates.indexOf(selectedDate);
  const insight = useMemo(() => context
    ? isToday
      ? buildStrainDetailInsight(context, heartRate, checkIn)
      : buildHistoricalStrainDetailInsight(items, selectedTrend, heartRate, checkIn)
    : null, [checkIn, context, heartRate, isToday, items, selectedTrend]);
  const heartRateDisplay = useMemo(() => describeAllDayHeartRateSync(
    heartRate,
    heartRateSync,
    syncingHr,
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
  ), [heartRate, heartRateSync, syncingHr]);
  useEffect(() => { setCheckIn(loadDailyStrainCheckIn(selectedDate)); }, [selectedDate]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await Promise.all([load(true), ...(isToday ? [refreshHeartRate(true)] : [])]); event.detail.complete(); };
  const updateCheckIn = (values: Partial<Pick<DailyStrainCheckIn, 'stress' | 'environment'>>) => {
    const next = { ...checkIn, ...values, updatedAt: new Date().toISOString() };
    setCheckIn(next); saveDailyStrainCheckIn(next);
  };

  return <IonPage>
    <IonHeader translucent className="strain-header"><IonToolbar>
      <button type="button" className="strain-back" aria-label="Back To Today" onClick={() => navigateBackOr(history, '/tabs/today')}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Strain Detail</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="strain-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="strain-shell">
        <header className="strain-intro"><p>{isToday ? 'Today’s Load' : 'Strain History'}</p><h1>{isToday ? 'See What Is Adding Strain' : formatLongDate(selectedDate)}</h1><span>Workout load with heart-rate and lifestyle context. Contributors are possibilities, not medical diagnoses.</span></header>
        {context && <nav className="strain-date-browser" aria-label="Choose Strain Date">
          <div className="strain-date-heading"><IonIcon icon={calendarClearOutline} /><span><small>Selected Day</small><strong>{isToday ? `Today · ${formatShortDate(selectedDate)}` : formatLongDate(selectedDate)}</strong></span>{!isToday && <button type="button" onClick={() => setSelectedDate(context.todayDate)}>Today</button>}</div>
          <div className="strain-date-days">
            <button type="button" aria-label="Previous Strain Date" disabled={selectedDateIndex <= 0} onClick={() => setSelectedDate(availableDates[selectedDateIndex - 1])}><IonIcon icon={chevronBackOutline} /></button>
            {availableDates.map((date) => <button type="button" className={date === selectedDate ? 'is-selected' : ''} aria-pressed={date === selectedDate} aria-label={formatLongDate(date)} onClick={() => setSelectedDate(date)} key={date}><small>{weekday(date)}</small><strong>{Number(date.slice(-2))}</strong></button>)}
            <button type="button" aria-label="Next Strain Date" disabled={selectedDateIndex < 0 || selectedDateIndex >= availableDates.length - 1} onClick={() => setSelectedDate(availableDates[selectedDateIndex + 1])}><IonIcon icon={chevronForwardOutline} /></button>
          </div>
        </nav>}
        {loading && !insight && <PageDataSkeleton variant="trends" label="Building Strain Detail" />}
        {!loading && error && !insight && <PageState kind="error" title="Strain Detail Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load(true)} />}
        {insight && context && <>
          <section className="strain-hero">
            <div className={`strain-ring is-${insight.level}`} style={{ '--strain-progress': `${Math.min(100, insight.score / 21 * 100)}%` } as React.CSSProperties}><div><strong>{insight.score.toFixed(1)}</strong><span>/21</span></div></div>
            <div className="strain-hero-summary"><p>{isToday ? 'Today’s Strain' : 'Recorded Strain'}</p><h2>{labelLevel(insight.level)}</h2><span>{insight.score === 0 ? 'No recorded activity for this day.' : insight.rangeStatus === 'within' ? 'Aligned with this day’s Recovery.' : insight.rangeStatus === 'above' ? 'Above this day’s compatible range.' : insight.rangeStatus === 'below' ? 'Below this day’s compatible range.' : 'Recovery comparison is unavailable.'}</span></div>
            <div className="strain-hero-range">
              <span><small>Recovery-Compatible Range</small><strong>{insight.compatibleRange ? `${insight.compatibleRange.minimum}–${insight.compatibleRange.maximum} · ${insight.compatibleRange.label}` : 'Not available for this day'}</strong></span>
              {insight.compatibleRange && <><div className="strain-range-track"><i className="range-zone" style={{ left: `${insight.compatibleRange.minimum / 21 * 100}%`, width: `${(insight.compatibleRange.maximum - insight.compatibleRange.minimum) / 21 * 100}%` }} /><i className="range-current" style={{ left: `${Math.min(100, insight.score / 21 * 100)}%` }} /></div><div className="strain-range-scale"><span>0</span><span>Light</span><span>Moderate</span><span>21</span></div></>}
            </div>
          </section>

          <section className="strain-card">
            <SectionTitle icon={pulseOutline} eyebrow="All-Day Heart Rate" title={isToday ? 'Observed Today' : formatLongDate(selectedDate)} />
            <HeartRateChart summary={heartRate} />
            <div className="strain-hr-stats"><Metric label="Average" value={heartRate.averageBpm == null ? '—' : `${heartRate.averageBpm.toFixed(0)} bpm`} /><Metric label="Range" value={heartRate.minimumBpm == null ? '—' : `${heartRate.minimumBpm.toFixed(0)}–${heartRate.maximumBpm?.toFixed(0)} bpm`} /><Metric label="Coverage" value={`${heartRate.coveragePercent}%`} /></div>
            {isToday ? <div className={`strain-sync-note is-${heartRateDisplay.kind}`} role="status" aria-live="polite">
              <span><strong>{heartRateDisplay.title}</strong><small>{heartRateDisplay.detail}</small></span>
              {heartRateDisplay.action && <button type="button" disabled={syncingHr} onClick={() => heartRateDisplay.action === 'permissions' ? history.push('/health-connect') : void refreshHeartRate(true)}><IonIcon icon={refreshOutline} />{heartRateDisplay.actionLabel}</button>}
            </div> : <div className={`strain-sync-note ${heartRate.buckets.length ? 'is-current' : 'is-unavailable'}`} role="status"><span><strong>{heartRate.buckets.length ? 'Saved heart-rate timeline' : 'No retained HR data for this day'}</strong><small>RunMate keeps all-day HR summaries on this device for 7 days.</small></span></div>}
          </section>

          <section className="strain-card">
            <SectionTitle icon={flameOutline} eyebrow="Likely Contributors" title="What May Be Adding Load" />
            {insight.contributors.length ? <div className="strain-contributors">{insight.contributors.map((item) => <Contributor item={item} key={item.key} />)}</div> : <p className="strain-empty-copy">No strong contributor is available yet. More HR coverage or a quick check-in can add context.</p>}
          </section>

          <section className="strain-card strain-checkin">
            <SectionTitle icon={heartOutline} eyebrow="Quick Context" title={isToday ? 'How Does Today Feel?' : 'How Did This Day Feel?'} />
            <fieldset><legend>Stress</legend><div className="strain-choice-row">{(['low', 'moderate', 'high'] as StressLevel[]).map((value) => <button type="button" aria-pressed={checkIn.stress === value} className={checkIn.stress === value ? 'is-selected' : ''} onClick={() => updateCheckIn({ stress: checkIn.stress === value ? null : value })} key={value}>{title(value)}</button>)}</div></fieldset>
            <fieldset><legend>Conditions</legend><div className="strain-choice-row">{([['normal', 'Normal'], ['hot_humid', 'Hot / Humid'], ['indoor', 'Indoor']] as Array<[EnvironmentContext, string]>).map(([value, label]) => <button type="button" aria-pressed={checkIn.environment === value} className={checkIn.environment === value ? 'is-selected' : ''} onClick={() => updateCheckIn({ environment: checkIn.environment === value ? null : value })} key={value}>{label}</button>)}</div></fieldset>
            <p><IonIcon icon={informationCircleOutline} />Stress and weather are user-confirmed context. RunMate never diagnoses either from HR alone.</p>
          </section>

          <section className="strain-card">
            <SectionTitle icon={fitnessOutline} eyebrow="Last 7 Days" title="Daily Strain" />
            <div className="strain-week-bars" role="img" aria-label={trend.map((point) => `${point.date}: ${point.strain ?? 'no strain'}`).join('; ')}>{trend.map((point) => <div key={point.date}><i style={{ height: `${Math.max(3, (point.strain ?? 0) / 21 * 100)}%` }} /><strong>{point.strain == null ? '—' : point.strain.toFixed(0)}</strong><span>{weekday(point.date)}</span></div>)}</div>
          </section>

          <section className="strain-next"><IonIcon icon={partlySunnyOutline} /><div><p>{isToday ? 'What To Do Next' : 'Day Summary'}</p><h2>{insight.nextAction}</h2></div></section>
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function HeartRateChart({ summary }: { summary: AllDayHeartRateSummary }) {
  if (summary.buckets.length < 2) return <div className="strain-chart-empty"><IonIcon icon={pulseOutline} /><span>More HR samples are needed to draw this day’s timeline.</span></div>;
  const width = 320; const height = 92;
  const minTime = Date.parse(summary.buckets[0].start); const maxTime = Date.parse(summary.buckets.at(-1)!.start);
  const minBpm = Math.max(35, Math.min(...summary.buckets.map((bucket) => bucket.minimumBpm)) - 5);
  const maxBpm = Math.max(minBpm + 20, Math.max(...summary.buckets.map((bucket) => bucket.maximumBpm)) + 5);
  const points = summary.buckets.map((bucket) => `${((Date.parse(bucket.start) - minTime) / Math.max(1, maxTime - minTime)) * width},${height - ((bucket.averageBpm - minBpm) / (maxBpm - minBpm)) * height}`).join(' ');
  return <div className="strain-hr-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Heart rate timeline from ${summary.minimumBpm} to ${summary.maximumBpm} bpm`}><line x1="0" x2={width} y1={height / 2} y2={height / 2} /><polyline points={points} /></svg><div><span>{clock(summary.buckets[0].start)}</span><span>{clock(summary.buckets.at(-1)!.start)}</span></div></div>;
}

function Contributor({ item }: { item: StrainContributor }) { const icon = item.key === 'caffeine' ? cafeOutline : item.key === 'heat' ? thermometerOutline : item.key === 'workout' ? fitnessOutline : item.key === 'heart_rate' ? pulseOutline : heartOutline; return <article className={`is-${item.confidence}`}><IonIcon icon={icon} /><div><strong>{item.title}</strong><span>{item.detail}</span></div><small>{item.confidence === 'high' ? 'Confirmed' : item.confidence === 'possible' ? 'Possible' : 'Context'}</small></article>; }
function SectionTitle({ icon, eyebrow, title }: { icon: string; eyebrow: string; title: string }) { return <header className="strain-section-title"><IonIcon icon={icon} /><div><p>{eyebrow}</p><h2>{title}</h2></div></header>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function labelLevel(level: string): string { return level === 'all_out' ? 'All Out' : title(level); }
function title(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function weekday(date: string): string { return new Intl.DateTimeFormat('en', { weekday: 'narrow', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T12:00:00+07:00`)); }
function formatLongDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T12:00:00+07:00`)); }
function formatShortDate(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T12:00:00+07:00`)); }
function clock(value: string): string { return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value)); }

export default StrainDetailPage;

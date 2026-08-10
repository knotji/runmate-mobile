import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, chevronBackOutline, chevronForwardOutline, shareSocialOutline } from 'ionicons/icons';
import { daysBetween, endOfMonth, shiftDate, shiftMonths, startOfMonth, todayBangkokDateKey, weekdayIndex } from '@/lib/date';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { buildRecoveryTrend } from '@/lib/recoveryTrends';
import { buildPeriodAdherence, buildPeriodTrainingSummary, buildWeeklyRecapHighlights, type RecapPeriod, type WeeklyRecapHighlights } from '@/lib/weeklyRecapHighlights';
import { useAsyncLoad } from '@/lib/hooks/useAsyncLoad';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { SocialShareModal } from '@/components/SocialShareModal';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { navigateBackOr } from '@/lib/navigationBack';
import { loadRecoveryContextStartupSnapshot } from '@/lib/recoveryStartupCache';
import { loadWeeklySummaryHistorySnapshot, saveWeeklySummaryHistorySnapshot } from '@/lib/weeklySummaryStartupCache';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { RacePlan } from '@/types/race';
import './WeeklyRecapPage.css';

/** Full Bangkok calendar period. Weeks run Monday through Sunday. */
function periodRange(period: RecapPeriod, offset: number, todayDate: string): { periodStart: string; periodEnd: string } {
  if (period === 'week') {
    const monday = shiftDate(todayDate, -((weekdayIndex(todayDate) + 6) % 7));
    const periodStart = shiftDate(monday, -7 * offset);
    return { periodStart, periodEnd: shiftDate(periodStart, 6) };
  }
  const periodStart = shiftMonths(startOfMonth(todayDate), -offset);
  return { periodStart, periodEnd: endOfMonth(periodStart) };
}

const WeeklyRecapPage: React.FC = () => {
  const history = useHistory();
  const context = useCoachContextStore((state) => state.context);
  const [startupContext] = useState(() => loadRecoveryContextStartupSnapshot());
  const visibleContext = context ?? startupContext;
  const [startupHistory] = useState(() => loadWeeklySummaryHistorySnapshot());
  const [period, setPeriod] = useState<RecapPeriod>('week');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<LocalHistoryItem[]>(startupHistory ?? []);
  const [racePlan, setRacePlan] = useState<RacePlan | null>(() => visibleContext?.racePlan as RacePlan | null ?? null);
  const [profile, setProfile] = useState(() => visibleContext?.profile ?? null);
  const [dataReady, setDataReady] = useState(startupHistory !== null && visibleContext !== null);
  const [shareOpen, setShareOpen] = useState(false);
  const [periodChanging, setPeriodChanging] = useState(false);
  const periodMounted = useRef(false);
  const todayDate = visibleContext?.todayDate ?? todayBangkokDateKey();

  const { loading, error, reload: load } = useAsyncLoad(async (force) => {
    const [race, historyResult, profileResult] = await Promise.all([
      force || !visibleContext ? loadActiveRaceGoalAndPlan() : Promise.resolve(null),
      loadHistoryItems(['workout', 'strength', 'sleep', 'meal']),
      force || !visibleContext ? loadProfileFromSupabase() : Promise.resolve(null),
    ]);
    if (!historyResult.ok) {
      if (!startupHistory) throw new Error(historyResult.error ?? 'Could Not Load Your Recap.');
    } else {
      setItems(historyResult.items);
      saveWeeklySummaryHistorySnapshot(historyResult.items);
    }
    if (race) setRacePlan(race.ok ? race.plan : null);
    if (profileResult) setProfile(profileResult.ok ? profileResult.profile ?? null : null);
    setDataReady(true);
  }, 'Could Not Load Your Recap.');

  useEffect(() => {
    if (!periodMounted.current) {
      periodMounted.current = true;
      return;
    }
    const timer = window.setTimeout(() => setPeriodChanging(false), 220);
    return () => window.clearTimeout(timer);
  }, [period, offset]);

  const highlights = useMemo<WeeklyRecapHighlights | null>(() => {
    if (!dataReady) return null;
    const { periodStart, periodEnd } = periodRange(period, offset, todayDate);
    const analysisEnd = periodEnd > todayDate ? todayDate : periodEnd;
    const elapsedDays = Math.max(1, daysBetween(periodStart, analysisEnd) + 1);
    const { points, insight } = buildRecoveryTrend(items, profile, elapsedDays, analysisEnd);
    const summary = buildPeriodTrainingSummary(items, periodStart, periodEnd);
    const adherence = buildPeriodAdherence(racePlan, items, periodStart, periodEnd, todayDate);
    return buildWeeklyRecapHighlights({
      period,
      periodStart,
      periodEnd,
      summary,
      adherence,
      recoveryPoints: points,
      recoveryInsight: insight,
    });
  }, [dataReady, items, offset, period, profile, racePlan, todayDate]);

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(true); event.detail.complete(); };

  const changePeriod = (next: RecapPeriod) => {
    if (next === period) return;
    setPeriodChanging(true);
    setPeriod(next);
    setOffset(0);
  };
  const movePeriod = (nextOffset: number) => {
    if (nextOffset === offset) return;
    setPeriodChanging(true);
    setOffset(nextOffset);
  };

  return (
    <IonPage>
      <IonHeader translucent className="recap-header">
        <IonToolbar>
          <button type="button" className="recap-back" aria-label="Back To Weekly Summary" onClick={() => navigateBackOr(history, '/weekly-summary')}><IonIcon icon={arrowBackOutline} /></button>
          <IonTitle>Your Recap</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="recap-content">
        <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
        <main className="recap-shell">
          <div className="recap-period-toggle" role="group" aria-label="Recap period">
            <button type="button" className={period === 'week' ? 'active' : ''} aria-pressed={period === 'week'} onClick={() => changePeriod('week')}>Week</button>
            <button type="button" className={period === 'month' ? 'active' : ''} aria-pressed={period === 'month'} onClick={() => changePeriod('month')}>Month</button>
          </div>

          <nav className="recap-period-nav" aria-label={`Choose ${period}`}>
            <button type="button" className="recap-period-arrow" aria-label={`Previous ${period}`} disabled={periodChanging} onClick={() => movePeriod(offset + 1)}>
              <IonIcon icon={chevronBackOutline} />
            </button>
            <span>{highlights ? highlights.dateRangeLabel : '—'}</span>
            <button type="button" className="recap-period-arrow" aria-label={`Next ${period}`} disabled={periodChanging || offset === 0} onClick={() => movePeriod(Math.max(0, offset - 1))}>
              <IonIcon icon={chevronForwardOutline} />
            </button>
          </nav>
          <div className={`recap-period-loading${periodChanging ? ' visible' : ''}`} role="status" aria-live="polite">
            {periodChanging && <><IonSpinner name="crescent" /><span>Updating {period === 'week' ? 'Week' : 'Month'}</span></>}
          </div>

          {loading && !dataReady && <PageDataSkeleton variant="summary" label="Building Your Recap" />}
          {!dataReady && error && <PageState kind="error" title="Recap Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="recap-state" />}

          {highlights && (
            <>
              <header className="recap-heading">
                <h1>{offset === 0 ? highlights.periodTitle : highlights.period === 'week' ? 'That Week' : 'That Month'}</h1>
              </header>

              <section className="recap-hero-card">
                <div className="recap-recovery-ring" data-has-score={highlights.recoveryAverage != null}>
                  <strong>{highlights.recoveryAverage ?? '—'}</strong>
                  <span>AVG RECOVERY / 100</span>
                </div>
                <p className="recap-insight-title">{highlights.recoveryInsightTitle}</p>
                <p className="recap-insight-summary">{highlights.recoveryInsightSummary}</p>
              </section>

              <section className="recap-stat-grid">
                <RecapStat label="Sleep Best" value={highlights.sleepBestScore != null ? `${highlights.sleepBestScore}` : '—'} />
                <RecapStat label="Adherence" value={highlights.adherencePlanned > 0 ? `${highlights.adherencePercentage}%` : '—'} />
                <RecapStat label="Sessions" value={String(highlights.sessions)} />
              </section>

              <section className="recap-stat-grid">
                <RecapStat label="Distance" value={`${highlights.distanceKm.toFixed(1)} km`} />
                <RecapStat label="Active Time" value={formatMinutes(highlights.activeMinutes)} />
                {highlights.topTrainingMixLabel && <RecapStat label="Mostly" value={highlights.topTrainingMixLabel} />}
              </section>

              {highlights.adherencePlanned > 0 && (
                <section className="recap-adherence-card">
                  <div className="recap-adherence-track"><i style={{ width: `${highlights.adherencePercentage}%` }} /></div>
                  <span>{highlights.adherenceCompleted + highlights.adherenceModified} Of {highlights.adherencePlanned} Planned Sessions Done</span>
                </section>
              )}

              <button type="button" className="recap-share-btn" onClick={() => setShareOpen(true)}>
                <IonIcon icon={shareSocialOutline} /> Share Your {highlights.period === 'week' ? 'Week' : 'Month'}
              </button>
            </>
          )}
        </main>
      </IonContent>

      <SocialShareModal
        isOpen={shareOpen}
        onDismiss={() => setShareOpen(false)}
        mode="weekly"
        weeklyData={highlights}
      />
    </IonPage>
  );
};

function RecapStat({ label, value }: { label: string; value: string }) {
  return <div className="recap-stat"><strong>{value}</strong><span>{label}</span></div>;
}

function formatMinutes(minutes: number): string {
  if (!minutes) return '0 min';
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return hours ? `${hours}h ${rest}m` : `${rest} min`;
}

export default WeeklyRecapPage;

import { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, chevronBackOutline, chevronForwardOutline, shareSocialOutline } from 'ionicons/icons';
import { daysBetween, endOfMonth, shiftDate, shiftMonths, startOfMonth, startOfWeek, todayBangkokDateKey } from '@/lib/date';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { buildRecoveryTrend } from '@/lib/recoveryTrends';
import { buildPeriodAdherence, buildPeriodTrainingSummary, buildWeeklyRecapHighlights, type RecapPeriod, type WeeklyRecapHighlights } from '@/lib/weeklyRecapHighlights';
import { useAsyncLoad } from '@/lib/hooks/useAsyncLoad';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { SocialShareModal } from '@/components/SocialShareModal';
import './WeeklyRecapPage.css';

/** [periodStart, periodEnd] for the given period/offset. offset 0 is the current, still-in-progress period (periodEnd capped at today); offset > 0 is a fully-elapsed past period. */
function periodRange(period: RecapPeriod, offset: number, todayDate: string): { periodStart: string; periodEnd: string } {
  if (period === 'week') {
    const periodStart = shiftDate(startOfWeek(todayDate), -7 * offset);
    return { periodStart, periodEnd: offset === 0 ? todayDate : shiftDate(periodStart, 6) };
  }
  const periodStart = shiftMonths(startOfMonth(todayDate), -offset);
  return { periodStart, periodEnd: offset === 0 ? todayDate : endOfMonth(periodStart) };
}

const WeeklyRecapPage: React.FC = () => {
  const history = useHistory();
  const [period, setPeriod] = useState<RecapPeriod>('week');
  const [offset, setOffset] = useState(0);
  const [highlights, setHighlights] = useState<WeeklyRecapHighlights | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const isFirstRender = useRef(true);

  const { loading, error, reload: load } = useAsyncLoad(async () => {
    const todayDate = todayBangkokDateKey();
    const [race, historyResult, profileResult] = await Promise.all([
      loadActiveRaceGoalAndPlan(),
      loadHistoryItems(['workout', 'strength', 'sleep']),
      loadProfileFromSupabase(),
    ]);
    if (!historyResult.ok) throw new Error(historyResult.error ?? 'Could Not Load Your Recap.');
    const items = historyResult.items;
    const profile = profileResult.ok ? profileResult.profile ?? null : null;

    const { periodStart, periodEnd } = periodRange(period, offset, todayDate);
    const elapsedDays = daysBetween(periodStart, periodEnd) + 1;
    const { points, insight } = buildRecoveryTrend(items, profile, elapsedDays, periodEnd);
    const summary = buildPeriodTrainingSummary(items, periodStart, periodEnd);
    const adherence = buildPeriodAdherence(race.ok ? race.plan : null, items, periodStart, periodEnd, todayDate);
    setHighlights(buildWeeklyRecapHighlights({
      period,
      periodStart,
      periodEnd,
      summary,
      adherence,
      recoveryPoints: points,
      recoveryInsight: insight,
    }));
  }, 'Could Not Load Your Recap.');

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load();
  }, [period, offset, load]);

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  const changePeriod = (next: RecapPeriod) => {
    setPeriod(next);
    setOffset(0);
  };

  return (
    <IonPage>
      <IonHeader translucent className="recap-header">
        <IonToolbar>
          <button type="button" className="recap-back" aria-label="Back To Weekly Summary" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
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
            <button type="button" className="recap-period-arrow" aria-label={`Previous ${period}`} disabled={loading} onClick={() => setOffset((value) => value + 1)}>
              <IonIcon icon={chevronBackOutline} />
            </button>
            <span>{highlights ? highlights.dateRangeLabel : '—'}</span>
            <button type="button" className="recap-period-arrow" aria-label={`Next ${period}`} disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 1))}>
              <IonIcon icon={chevronForwardOutline} />
            </button>
          </nav>

          {loading && <PageDataSkeleton variant="summary" label="Building Your Recap" />}
          {!loading && error && <PageState kind="error" title="Recap Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="recap-state" />}

          {!loading && !error && highlights && (
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

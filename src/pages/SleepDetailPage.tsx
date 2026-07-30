import { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonButton, IonContent, IonDatetime, IonHeader, IonIcon, IonModal, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, calendarClearOutline, checkmarkCircleOutline, chevronBackOutline, chevronForwardOutline, warningOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase, buildRecoveryCoreContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { buildSleepDiagnostics } from '@/lib/sleepDiagnostics';
import { calculateRunMateSleepScore } from '@/lib/runMateSleepScore';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { RecordReliability, SleepHeartRate, SleepScoreBreakdown, SleepStages } from '@/components/health/SleepDetailSections';
import { formatDisplayDate, formatEfficiency, formatOptionalMinutes, formatScore, toSleepScoreNight } from '@/lib/sleepDetailFormatting';
import { useAsyncLoad } from '@/lib/hooks/useAsyncLoad';
import { loadRecoveryContextStartupEntry, saveRecoveryContextStartupSnapshot } from '@/lib/recoveryStartupCache';
import { requiresFullSleepHistory } from '@/lib/sleepDetailLoad';
import { recoveryDataStatusCopy, resolveRecoveryDataStatus } from '@/lib/recoveryDataFreshness';
import './SleepDetailPage.css';

const SleepDetailPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const routeParams = new URLSearchParams(location.search);
  const initialDate = routeParams.get('date');
  const backPath = routeParams.get('from') === 'activity' ? '/tabs/activity' : '/tabs/recovery';
  const context = useCoachContextStore((state) => state.context);
  const [startupEntry] = useState(() => loadRecoveryContextStartupEntry());
  const startupContext = startupEntry?.context ?? null;
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<string | null>(() => startupEntry?.savedAt ?? null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    setSelectedDate(initialDate);
    setCalendarOpen(false);
  }, [initialDate]);
  const { loading, error, reload: load } = useAsyncLoad(async (force = false) => {
    try {
      let nextContext = await buildRecoveryCoreContextFromSupabase({ force });
      if (requiresFullSleepHistory(nextContext, initialDate)) {
        nextContext = await buildCoachContextFromSupabase({ force });
      }
      const savedAt = new Date().toISOString();
      saveRecoveryContextStartupSnapshot(nextContext, savedAt);
      setLastSuccessfulAt(savedAt);
      setRefreshFailed(false);
    } catch (failure) {
      setRefreshFailed(true);
      throw failure;
    }
  }, 'Unable to load sleep details.');

  const visibleContext = context ?? startupContext;
  const recovery = visibleContext?.recoverySystem ?? null;
  const selectedNight = visibleContext?.sleepHistory.find((night) => night.date === selectedDate)
    ?? visibleContext?.sleepHistory[0]
    ?? null;
  const diagnostics = visibleContext ? buildSleepDiagnostics(visibleContext, selectedNight?.date) : null;
  const latestDate = visibleContext?.sleepHistory[0]?.date ?? null;
  const isLatestNight = selectedNight?.date === latestDate;
  const availableNights = visibleContext?.sleepHistory ?? [];
  const selectedNightIndex = availableNights.findIndex((night) => night.date === selectedNight?.date);
  const scoreBreakdown = selectedNightIndex >= 0
    ? calculateRunMateSleepScore(availableNights.slice(selectedNightIndex, selectedNightIndex + 31).map(toSleepScoreNight))
    : null;
  const availableDates = new Set(availableNights.map((night) => night.date));
  const freshnessTitle = recovery?.scoreState === 'scored' ? 'Scored Today'
    : recovery?.scoreState === 'calibrating' ? 'Baseline Calibrating'
      : recovery?.scoreState === 'stale' ? 'Sleep Data Is Stale'
        : recovery?.scoreState === 'pending' ? 'Score Pending' : 'Not Scorable';
  const displayedStatusTitle = isLatestNight ? freshnessTitle : 'Historical Sleep Record';
  const displayedStatusBadge = isLatestNight
    ? (recovery?.dataFreshness.status === 'today' ? 'Current' : recovery?.dataFreshness.status)
    : 'Historical';
  const dataStatus = resolveRecoveryDataStatus({
    savedAt: lastSuccessfulAt,
    refreshing: loading && Boolean(visibleContext),
    refreshFailed,
  });
  const dataStatusCopy = recoveryDataStatusCopy(dataStatus, lastSuccessfulAt);

  const moveToNight = (date: string | undefined) => {
    if (!date || date === selectedNight?.date) return;
    setSelectedDate(date);
  };

  return (
    <IonPage>
      <IonHeader translucent className="sleep-detail-header">
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label="Go Back" onClick={() => history.push(backPath)}>
            <IonIcon slot="icon-only" icon={arrowBackOutline} />
          </IonButton>
          <IonTitle>Sleep Details</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="sleep-detail-content">
        <main className="sleep-detail-shell">
          {loading && !visibleContext && <PageDataSkeleton variant="detail" label="Loading Sleep Details" />}
          {!loading && error && !visibleContext && <PageState kind="error" title="Sleep Details Are Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="sleep-detail-loading" />}
          {visibleContext && recovery && diagnostics && (
            <>
              <div className={`sleep-data-freshness sleep-data-freshness-${dataStatus}`} role="status">
                <i />
                <span>{dataStatusCopy.detail}</span>
                {(dataStatus === 'stale' || dataStatus === 'fallback') && <button type="button" onClick={() => void load(true)}>Retry</button>}
              </div>
              {selectedNight && (
                <nav className={`sleep-date-navigator${!isLatestNight ? ' has-current' : ''}`} aria-label="Choose sleep night">
                  <button
                    type="button"
                    className="sleep-date-arrow"
                    aria-label="Previous night"
                    disabled={selectedNightIndex < 0 || selectedNightIndex >= availableNights.length - 1}
                    onClick={() => moveToNight(availableNights[selectedNightIndex + 1]?.date)}
                  ><IonIcon icon={chevronBackOutline} /></button>
                  <button type="button" className="sleep-date-button" aria-label={`Choose sleep night. Selected ${formatDisplayDate(selectedNight.date)}`} onClick={() => setCalendarOpen(true)}>
                    <IonIcon icon={calendarClearOutline} />
                    <span><small>Selected Night</small><strong>{formatDisplayDate(selectedNight.date)}</strong></span>
                  </button>
                  <button
                    type="button"
                    className="sleep-date-arrow"
                    aria-label="Next night"
                    disabled={selectedNightIndex <= 0}
                    onClick={() => moveToNight(availableNights[selectedNightIndex - 1]?.date)}
                  ><IonIcon icon={chevronForwardOutline} /></button>
                  {!isLatestNight && <button type="button" className="sleep-inline-current" onClick={() => moveToNight(latestDate ?? undefined)}>Current</button>}
                </nav>
              )}

              <section className={`freshness-card freshness-${recovery.dataFreshness.status}`}>
                <div className="freshness-card-copy">
                  <p>Recovery Status</p>
                  <h1>{displayedStatusTitle}</h1>
                  <span>{selectedNight
                    ? (isLatestNight ? 'Using your latest recorded sleep.' : 'Reviewing a previous sleep record.')
                    : 'No recent sleep session found'}</span>
                </div>
                <span className="freshness-badge">{displayedStatusBadge}</span>
              </section>

              <section className="sleep-detail-section">
                <header><p>{isLatestNight ? 'Latest Night' : 'Historical Night'}</p><h2>Sleep Summary</h2></header>
                <div className="sleep-metric-grid">
                  <Metric label="Sleep Score" value={formatScore(selectedNight?.score)} suffix={selectedNight?.score == null ? undefined : '/100'} helper="Calculated from this night's sleep" />
                  <Metric label="Sleep Duration" value={formatOptionalMinutes(selectedNight?.durationMinutes)} helper="Total time asleep" />
                  <Metric label="Time In Bed" value={formatOptionalMinutes(selectedNight?.timeInBedMinutes)} helper="From bedtime to wake time" />
                  <Metric label="Sleep Efficiency" value={formatEfficiency(selectedNight)} helper="Time asleep while in bed" />
                </div>
              </section>

              {scoreBreakdown?.score != null && <SleepScoreBreakdown result={scoreBreakdown} />}
              {selectedNight && <SleepStages night={selectedNight} />}
              {selectedNight && <SleepHeartRate night={selectedNight} />}
              {selectedNight && <RecordReliability night={selectedNight} />}

              <section className="sleep-detail-section sleep-coverage-section">
                <details className="sleep-detail-disclosure">
                  <summary>
                    <div><p>Data Coverage</p><h2>Signals Available</h2></div>
                    <span>{diagnostics.coverage.filter((item) => item.available).length}/{diagnostics.coverage.length} Signals</span>
                  </summary>
                  <div className="coverage-list">
                    {diagnostics.coverage.map((item) => (
                      <div className="coverage-row" key={item.label}>
                        <IonIcon icon={item.available ? checkmarkCircleOutline : warningOutline} className={item.available ? 'available' : 'missing'} />
                        <div className="coverage-copy">
                          <span>{item.label}</span>
                          <small>{item.available ? item.note ?? 'Included in sleep analysis' : 'Not received from your data source'}</small>
                        </div>
                        <strong className={item.available ? 'available' : 'missing'}>{item.value ?? 'Missing'}</strong>
                      </div>
                    ))}
                  </div>
                </details>
              </section>

              {diagnostics.warnings.length > 0 && (
                <section className="sleep-detail-section">
                  <header><p>Validation</p><h2>Things To Review</h2></header>
                  <div className="validation-list">{diagnostics.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
                </section>
              )}

            </>
          )}
        </main>
      </IonContent>
      <IonModal className="sleep-date-modal" isOpen={calendarOpen} onDidDismiss={() => setCalendarOpen(false)}>
        <IonDatetime
          presentation="date"
          value={selectedNight?.date}
          min={availableNights.at(-1)?.date}
          max={availableNights[0]?.date}
          isDateEnabled={(date) => availableDates.has(date)}
          onIonChange={(event) => {
            const value = event.detail.value;
            if (typeof value === 'string' && availableDates.has(value.slice(0, 10))) {
              setSelectedDate(value.slice(0, 10));
              setCalendarOpen(false);
            }
          }}
        />
      </IonModal>
    </IonPage>
  );
};

function Metric({ label, value, suffix, helper }: { label: string; value: string; suffix?: string; helper: string }) {
  return (
    <div className="sleep-detail-metric">
      <span>{label}</span>
      <strong>{value}{suffix && <small>{suffix}</small>}</strong>
      <p>{helper}</p>
    </div>
  );
}

export default SleepDetailPage;

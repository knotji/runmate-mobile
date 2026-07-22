import { useCallback, useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonButton, IonContent, IonDatetime, IonHeader, IonIcon, IonModal, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, calendarClearOutline, checkmarkCircleOutline, chevronBackOutline, chevronForwardOutline, warningOutline } from 'ionicons/icons';
import type { CoachContext, WeekSleepRow } from '@/lib/buildCoachContext';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { buildSleepDiagnostics } from '@/lib/sleepDiagnostics';
import { calculateRunMateSleepScore, type RunMateSleepScoreResult, type SleepScoreComponent } from '@/lib/runMateSleepScore';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import './SleepDetailPage.css';

const SleepDetailPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const routeParams = new URLSearchParams(location.search);
  const initialDate = routeParams.get('date');
  const backPath = routeParams.get('from') === 'activity' ? '/tabs/activity' : '/tabs/recovery';
  const [context, setContext] = useState<CoachContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [nightLoading, setNightLoading] = useState(false);
  useEffect(() => {
    setSelectedDate(initialDate);
    setCalendarOpen(false);
    setNightLoading(false);
  }, [initialDate]);
  const load = useCallback(async () => {
    try { setContext(await buildCoachContextFromSupabase()); }
    catch (loadError) { console.error('[sleep-detail] load failed', loadError); setError('Unable to load sleep details.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const recovery = context?.recoverySystem ?? null;
  const selectedNight = context?.sleepHistory.find((night) => night.date === selectedDate)
    ?? context?.sleepHistory[0]
    ?? null;
  const diagnostics = context ? buildSleepDiagnostics(context, selectedNight?.date) : null;
  const latestDate = context?.sleepHistory[0]?.date ?? null;
  const isLatestNight = selectedNight?.date === latestDate;
  const availableNights = context?.sleepHistory ?? [];
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

  const moveToNight = (date: string | undefined) => {
    if (!date || date === selectedNight?.date || nightLoading) return;
    setNightLoading(true);
    window.setTimeout(() => {
      setSelectedDate(date);
      setNightLoading(false);
    }, 240);
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
          {!context && !error && <PageDataSkeleton variant="detail" label="Loading Sleep Details" />}
          {error && <PageState kind="error" title="Sleep Details Are Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="sleep-detail-loading" />}
          {context && recovery && diagnostics && (
            <>
              {selectedNight && (
                <nav className={`sleep-date-navigator${!isLatestNight ? ' has-current' : ''}`} aria-label="Choose sleep night">
                  <button
                    type="button"
                    className="sleep-date-arrow"
                    aria-label="Previous night"
                    disabled={nightLoading || selectedNightIndex < 0 || selectedNightIndex >= availableNights.length - 1}
                    onClick={() => moveToNight(availableNights[selectedNightIndex + 1]?.date)}
                  ><IonIcon icon={chevronBackOutline} /></button>
                  <button type="button" className="sleep-date-button" disabled={nightLoading} onClick={() => setCalendarOpen(true)}>
                    {nightLoading ? <IonSpinner name="crescent" /> : <IonIcon icon={calendarClearOutline} />}
                    <span><small>{nightLoading ? 'Loading Night' : 'Selected Night'}</small><strong>{nightLoading ? 'Updating…' : formatDisplayDate(selectedNight.date)}</strong></span>
                  </button>
                  <button
                    type="button"
                    className="sleep-date-arrow"
                    aria-label="Next night"
                    disabled={nightLoading || selectedNightIndex <= 0}
                    onClick={() => moveToNight(availableNights[selectedNightIndex - 1]?.date)}
                  ><IonIcon icon={chevronForwardOutline} /></button>
                  {!isLatestNight && <button type="button" className="sleep-inline-current" disabled={nightLoading} onClick={() => moveToNight(latestDate ?? undefined)}>Current</button>}
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

function SleepScoreBreakdown({ result }: { result: RunMateSleepScoreResult }) {
  const availableCount = result.components.filter((component) => component.score != null).length;
  const reweighted = availableCount < result.components.length;
  return (
    <section className="sleep-detail-section sleep-score-breakdown-section">
      <details className="sleep-detail-disclosure sleep-score-breakdown">
        <summary>
          <div><p>Sleep Score</p><h2>How This Score Was Built</h2></div>
          <span>{availableCount}/{result.components.length} Factors</span>
        </summary>
        <div className="sleep-score-factor-list">
          {result.components.map((component) => (
            <div className={`sleep-score-factor${component.score == null ? ' missing' : ''}`} key={component.key}>
              <IonIcon icon={component.score == null ? warningOutline : checkmarkCircleOutline} />
              <div className="sleep-score-factor-copy">
                <div><strong>{component.label}</strong><span>{scoreFactorDetail(component, result)}</span></div>
                {component.score != null && <i aria-hidden="true"><span style={{ width: `${component.score}%` }} /></i>}
              </div>
              <div className="sleep-score-factor-value">
                <strong>{component.score == null ? 'Missing' : `${Math.round(component.score)}/100`}</strong>
                <span>{componentWeightLabel(component)}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="sleep-score-method-note">
          {reweighted
            ? 'Missing factors stay missing. Their weight is redistributed across the factors available for this night.'
            : 'All four factors were available. Standard weighting was used for this night.'}
        </p>
      </details>
    </section>
  );
}

function scoreFactorDetail(component: SleepScoreComponent, result: RunMateSleepScoreResult): string {
  if (component.score == null) {
    return component.key === 'consistency' ? 'Needs at least three timed nights' : 'Not available for this night';
  }
  if (component.key === 'duration') return `${formatOptionalMinutes(result.actualSleepMinutes)} of ${formatMinutes(result.sleepNeedMinutes)} Sleep Need`;
  if (component.key === 'consistency') return 'Bedtime and wake-time regularity';
  if (component.key === 'efficiency') return 'Sleep time compared with Time In Bed';
  return 'REM and Deep share of staged sleep';
}

function componentWeightLabel(component: SleepScoreComponent): string {
  if (component.score == null) return `${component.baseWeight}% reweighted`;
  const effective = Math.round(component.effectiveWeight);
  return effective === component.baseWeight ? `${component.baseWeight}% weight` : `${component.baseWeight}% → ${effective}% used`;
}

function toSleepScoreNight(night: WeekSleepRow) {
  return {
    durationMinutes: night.durationMinutes,
    timeInBedMinutes: night.timeInBedMinutes,
    sleepStartTime: night.sleepStartTime,
    sleepEndTime: night.sleepEndTime,
    remMinutes: night.remMinutes,
    lightMinutes: night.lightMinutes,
    deepMinutes: night.deepMinutes,
  };
}

function SleepStages({ night }: { night: WeekSleepRow }) {
  const stages = [
    { label: 'Awake', value: night.awakeMinutes, className: 'awake' },
    { label: 'REM', value: night.remMinutes, className: 'rem' },
    { label: 'Light', value: night.lightMinutes, className: 'light' },
    { label: 'Deep', value: night.deepMinutes, className: 'deep' },
  ];
  const total = stages.reduce((sum, stage) => sum + (stage.value ?? 0), 0);
  if (total <= 0) return (
    <section className="sleep-detail-section">
      <header><p>Sleep Stages</p><h2>No Stage Data</h2></header>
      <p className="sleep-stages-empty">Your data source did not provide sleep stages for this night.</p>
    </section>
  );
  return (
    <section className="sleep-detail-section">
      <header><p>Sleep Stages</p><h2>How Your Night Was Spent</h2></header>
      <div className="sleep-stages-card">
        <div className="sleep-stage-bar" aria-label="Sleep stage distribution">
          {stages.map((stage) => stage.value != null && stage.value > 0
            ? <span key={stage.label} className={stage.className} style={{ width: `${(stage.value / total) * 100}%` }} />
            : null)}
        </div>
        <div className="sleep-stage-legend">
          {stages.map((stage) => (
            <div key={stage.label}><i className={stage.className} /><span>{stage.label}</span><strong>{formatOptionalMinutes(stage.value)}</strong></div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SleepHeartRate({ night }: { night: WeekSleepRow }) {
  const points = (night.sleepHeartRateTimeline ?? [])
    .map((point) => ({ at: Date.parse(point.at), bpm: point.bpm }))
    .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.bpm) && point.bpm >= 30 && point.bpm <= 240)
    .sort((a, b) => a.at - b.at);
  if (points.length < 2) return null;

  const average = night.avgSleepingHeartRate ?? Math.round(points.reduce((sum, point) => sum + point.bpm, 0) / points.length);
  const lowest = night.lowestSleepingHeartRate ?? Math.round(Math.min(...points.map((point) => point.bpm)));
  const width = 320;
  const height = 118;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 12;
  const startAt = Date.parse(night.sleepStartTime ?? '') || points[0].at;
  const endAt = Date.parse(night.sleepEndTime ?? '') || points.at(-1)!.at;
  const minBpm = Math.max(25, Math.floor(Math.min(...points.map((point) => point.bpm)) / 5) * 5 - 5);
  const maxBpm = Math.ceil(Math.max(...points.map((point) => point.bpm)) / 5) * 5 + 5;
  const x = (at: number) => left + Math.max(0, Math.min(1, (at - startAt) / Math.max(1, endAt - startAt))) * (width - left - right);
  const y = (bpm: number) => top + (1 - (bpm - minBpm) / Math.max(1, maxBpm - minBpm)) * (height - top - bottom);
  const paths: string[] = [];
  let path = '';
  points.forEach((point, index) => {
    if (index > 0 && point.at - points[index - 1].at > 20 * 60_000) {
      if (path) paths.push(path);
      path = '';
    }
    path += `${path ? ' L' : 'M'} ${x(point.at).toFixed(1)} ${y(point.bpm).toFixed(1)}`;
  });
  if (path) paths.push(path);

  return (
    <section className="sleep-detail-section sleep-heart-rate-section">
      <header><p>Overnight Vitals</p><h2>Sleep Heart Rate</h2></header>
      <div className="sleep-heart-rate-card">
        <div className="sleep-heart-rate-summary">
          <div><span>Average</span><strong>{average}<small>bpm</small></strong></div>
          <div><span>Lowest</span><strong>{lowest}<small>bpm</small></strong></div>
        </div>
        <div className="sleep-heart-rate-chart-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Sleep heart rate. Average ${average} bpm and lowest ${lowest} bpm.`}>
            {[.25, .5, .75].map((ratio) => <line key={ratio} x1={left} x2={width - right} y1={top + ratio * (height - top - bottom)} y2={top + ratio * (height - top - bottom)} className="sleep-heart-rate-grid" />)}
            <line x1={left} x2={width - right} y1={y(average)} y2={y(average)} className="sleep-heart-rate-average" />
            {paths.map((item, index) => <path key={index} d={item} className="sleep-heart-rate-line" />)}
          </svg>
        </div>
        <div className="sleep-heart-rate-times"><span>{formatSleepTime(startAt)}</span><span>{formatSleepTime(endAt)}</span></div>
        <p>Measured by Samsung Health during your recorded Sleep Window.</p>
      </div>
    </section>
  );
}

function RecordReliability({ night }: { night: WeekSleepRow }) {
  const sources = night.sources?.length ? night.sources : ['RunMate'];
  const correctedCount = Object.values(night.fieldSources ?? {}).filter((source) => source === 'User Corrected').length;
  const status = sources.length > 1 ? 'Reconciled' : 'Single Source';
  return (
    <section className="sleep-detail-section sleep-reliability-section">
      <details className="sleep-detail-disclosure">
        <summary>
          <div><p>Record Reliability</p><h2>Source And Merge</h2></div>
          <span>{status}</span>
        </summary>
        <div className="sleep-reliability-list">
          <div><span>Sources</span><strong>{sources.join(' + ')}</strong></div>
          <div><span>User Corrections</span><strong>{correctedCount ? `${correctedCount} Preserved` : 'None'}</strong></div>
          <div><span>Last Imported</span><strong>{formatImportedAt(night.lastImportedAt)}</strong></div>
        </div>
      </details>
    </section>
  );
}

function formatMinutes(value: number): string {
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}

function formatOptionalMinutes(value: number | null | undefined): string {
  return value == null ? '—' : formatMinutes(value);
}

function formatScore(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value)}`;
}

function formatEfficiency(night: WeekSleepRow | null): string {
  if (!night?.durationMinutes || !night.timeInBedMinutes) return '—';
  return `${Math.min(100, Math.round((night.durationMinutes / night.timeInBedMinutes) * 100))}%`;
}

function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function formatSleepTime(value: number): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

function formatImportedAt(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not Available';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

export default SleepDetailPage;

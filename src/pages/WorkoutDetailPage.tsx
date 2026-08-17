import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import {
  arrowBackOutline, barbellOutline, bicycleOutline, ellipseOutline, fitnessOutline, flameOutline, flashOutline,
  footstepsOutline, heartOutline, navigateOutline, shareSocialOutline, speedometerOutline, statsChartOutline,
  syncOutline, timeOutline, trendingUpOutline, walkOutline, waterOutline,
} from 'ionicons/icons';
import { SocialShareModal, type WorkoutShareData } from '@/components/SocialShareModal';
import { loadHistoryItemById, loadHistoryItems } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutDetail } from '@/lib/workoutDetail';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { useUserProfileStore } from '@/lib/profile/userProfileStore';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { loadActivityStartupSnapshot } from '@/lib/activityStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import './WorkoutDetailPage.css';

const WorkoutDetailPage: React.FC = () => {
  const history = useHistory();
  const { id } = useParams<{ id: string }>();
  const requestedId = decodeURIComponent(id);
  const [startupItem] = useState(() => findCachedWorkout(requestedId));
  const [item, setItem] = useState<LocalHistoryItem | null>(startupItem);
  const [loading, setLoading] = useState(() => startupItem === null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const profile = useUserProfileStore((state) => state.profile);
  const [restingHr, setRestingHr] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRefreshError(null);
    try {
      const [match, profileResult] = await Promise.all([
        measurePerformanceDiagnostic('workout_detail', () => loadRequestedWorkout(requestedId), (value) => ({
          status: value ? 'success' : 'failed',
          variant: startupItem ? 'prepared' : 'live',
          detail: value ? 'Requested workout prepared' : 'Requested workout not found',
        })),
        loadProfileFromSupabase(),
      ]);
      if (profileResult.ok) setRestingHr(profileResult.profile?.normalRestingHr ?? null);
      if (match) setItem(match);
      else if (startupItem) setRefreshError('Could not refresh this workout. Showing the saved Activity copy.');
      else setError('This workout record could not be found.');
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Could Not Load This Workout.';
      if (startupItem) setRefreshError(message);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [requestedId, startupItem]);

  useEffect(() => { void load(); }, [load]);

  const [showShareModal, setShowShareModal] = useState(false);
  const detail = item ? buildWorkoutDetail(item, { maxHr: profile?.maxHr, restingHr }) : null;

  const getSportType = (): 'running' | 'walking' | 'cycling' | 'strength' | 'swimming' | 'workout' => {
    if (detail?.isStrength) return 'strength';
    const titleLower = detail?.title.toLowerCase() ?? '';
    if (titleLower.includes('walk')) return 'walking';
    if (titleLower.includes('cycle') || titleLower.includes('bike')) return 'cycling';
    if (titleLower.includes('swim')) return 'swimming';
    if (titleLower.includes('run') || titleLower.includes('treadmill')) return 'running';
    return 'workout';
  };

  const shareExtracted = objectValue(objectValue(item?.data).extracted);

  const workoutShareData: WorkoutShareData | null = detail ? {
    title: detail.title,
    type: getSportType(),
    isStrength: detail.isStrength,
    distanceKm: numberValue(shareExtracted.distanceKm) ?? metersToKilometers(numberValue(shareExtracted.distanceM)) ?? undefined,
    durationSeconds: numberValue(shareExtracted.activeDurationSeconds) ?? metricDurationSeconds(detail.metrics) ?? 0,
    paceFormatted: detail.metrics.find((m) => m.label.toLowerCase().includes('pace'))?.value,
    avgHeartRateBpm: detail.summaryHr.avgHr ?? undefined,
    caloriesKcal: numberValue(shareExtracted.calories) ?? metricNumber(detail.metrics, 'calories') ?? undefined,
    elevationMeters: numberValue(shareExtracted.elevationGainMeters) ?? numberValue(shareExtracted.elevationGain) ?? metricNumber(detail.metrics, 'elevation') ?? undefined,
    loadScore: detail.heartRateZones?.load?.score,
    dateStr: detail.date,
  } : null;

  const getHeroIcon = () => {
    const sport = getSportType();
    if (sport === 'strength') return barbellOutline;
    if (sport === 'cycling') return bicycleOutline;
    if (sport === 'swimming') return waterOutline;
    if (sport === 'walking') return walkOutline;
    return fitnessOutline;
  };

  return (
    <IonPage>
      <IonHeader translucent className="workout-detail-header">
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label="Back To Move" onClick={() => history.push('/tabs/move')}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton>
          <IonTitle>Workout Detail</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowShareModal(true)} aria-label="Share Workout">
              <IonIcon icon={shareSocialOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="workout-detail-content">
        <main className="workout-detail-shell">
          {loading && <PageDataSkeleton variant="detail" label="Loading Workout Details" />}
          {!loading && error && !detail && <PageState kind="error" title="Workout Is Unavailable" detail={error} actionLabel="Back To Move" onAction={() => history.push('/tabs/move')} className="workout-detail-state" />}
          {detail && (
            <>
              {refreshError && <div className="workout-detail-refresh-note" role="status"><span>{refreshError}</span><button type="button" onClick={() => void load()}>Retry</button></div>}
              <section className={`workout-hero workout-hero-${detail.tone}`}>
                <div className="workout-hero-icon"><IonIcon icon={getHeroIcon()} /></div>
                <div><p>{detail.isStrength ? 'Strength Training' : 'Workout'}</p><h1>{detail.title}</h1><span>{detail.date}</span></div>
                {detail.intensity && <strong>{detail.intensity}</strong>}
              </section>

              {detail.heartRateZones ? (
                <section className="workout-detail-section">
                  <header><p>Heart Rate Reserve</p><h2>Heart Rate Zones</h2></header>
                  <div className="workout-zone-card">
                    <div className="workout-load-summary">
                      <div><span>RunMate Load</span><strong>{detail.heartRateZones.load ? detail.heartRateZones.load.score : '—'}<small>/100</small></strong></div>
                      <div><span>HR Coverage</span><strong>{detail.heartRateZones.coveragePercentage}<small>%</small></strong></div>
                      <em>{detail.heartRateZones.load?.level ?? 'More HR Data Needed'}</em>
                    </div>
                    <div className="workout-zone-list">
                      {[...detail.heartRateZones.zones].reverse().map((zone) => <div key={zone.zone} className={`workout-zone workout-zone-${zone.zone}${zone.seconds === 0 ? ' is-empty' : ''}`}><span>Z{zone.zone}</span><div><strong>{zone.label}</strong><small>{zoneRange(zone.lowerBpm, zone.upperBpm)}</small><i style={{ width: `${zone.percentage}%` }} /></div><b>{formatZoneDuration(zone.seconds)}<small>{zone.percentage}%</small></b></div>)}
                    </div>
                    <p className="workout-zone-note"><strong>Estimated With HRR</strong><span>Max HR {detail.heartRateZones.maxHr} · Resting HR {detail.heartRateZones.restingHr} · Gaps excluded</span></p>
                  </div>
                </section>
              ) : (
                <section className="workout-detail-section">
                  <header><p>Heart Rate Reserve</p><h2>Heart Rate Zones</h2></header>
                  <div className="workout-zone-card workout-zone-empty">
                    <p className="workout-zone-empty-note">
                      <strong>{detail.summaryHr.avgHr || detail.summaryHr.maxHr ? 'Continuous HR Timeline Needed' : 'No HR Data Recorded'}</strong>
                      <span>
                        {detail.summaryHr.avgHr || detail.summaryHr.maxHr
                          ? `This session has summary HR (${detail.summaryHr.avgHr ? `Avg ${detail.summaryHr.avgHr} bpm` : ''}${detail.summaryHr.maxHr ? ` · Max ${detail.summaryHr.maxHr} bpm` : ''}) but no minute-by-minute heart rate timeline was recorded by your smartwatch.`
                          : 'No heart rate measurements were synced or recorded for this workout session.'}
                      </span>
                    </p>
                  </div>
                </section>
              )}

              <section className="workout-detail-section">
                <header><p>Workout Metrics</p><h2>Session Overview</h2></header>
                {detail.metrics.length > 0 ? (
                  <div className="workout-metric-grid">{detail.metrics.map((metric) => <div key={metric.label}><span><IonIcon icon={metricIcon(metric.label)} aria-hidden="true" />{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
                ) : <p className="workout-empty-card">No structured workout metrics were provided for this session.</p>}
              </section>

              <section className="workout-detail-section workout-reliability-section">
                <details className="workout-reliability-disclosure">
                  <summary><div><p>Record Reliability</p><h2>Source And Merge</h2></div><span>{detail.reliability.status}</span></summary>
                  <div className="workout-reliability-list">
                    <div><span>Sources</span><strong>{detail.reliability.sources}</strong></div>
                    <div><span>User Corrections</span><strong>{detail.reliability.userCorrectedCount ? `${detail.reliability.userCorrectedCount} Preserved` : 'None'}</strong></div>
                    <div><span>Last Imported</span><strong>{formatImportedAt(detail.reliability.lastImportedAt)}</strong></div>
                  </div>
                </details>
              </section>

              {detail.exercises.length > 0 && (
                <section className="workout-detail-section">
                  <header><p>Exercises</p><h2>Strength Work</h2></header>
                  <div className="exercise-list">{detail.exercises.map((exercise, index) => <div key={`${exercise.name}-${index}`}><span>{index + 1}</span><div><strong>{exercise.name}</strong><p>{exercise.detail}</p></div></div>)}</div>
                </section>
              )}

              {detail.insights.length > 0 && (
                <section className="workout-detail-section workout-guidance-section">
                  <details open className="workout-guidance-disclosure">
                    <summary>
                      <div><p>Coach Notes</p><h2>Session Guidance</h2></div>
                      <span>{detail.insights.length} {detail.insights.length === 1 ? 'Note' : 'Notes'}</span>
                    </summary>
                    <div className="workout-insight-list">{detail.insights.map((insight) => <div key={insight.label}><span>{insight.label}</span><p>{insight.value}</p></div>)}</div>
                  </details>
                </section>
              )}

            </>
          )}
        </main>

        <SocialShareModal
          isOpen={showShareModal}
          onDismiss={() => setShowShareModal(false)}
          mode="workout"
          workoutData={workoutShareData}
        />
      </IonContent>
    </IonPage>
  );
};

export default WorkoutDetailPage;

function findCachedWorkout(requestedId: string): LocalHistoryItem | null {
  const cached = loadActivityStartupSnapshot() ?? [];
  return dedupeWorkoutItems(cached.filter(isWorkoutItem))
    .find((record) => record.id === requestedId || record.sourceRecordIds?.includes(requestedId)) ?? null;
}

async function loadRequestedWorkout(requestedId: string): Promise<LocalHistoryItem | null> {
  const direct = await loadHistoryItemById(requestedId);
  if (direct.ok && isWorkoutItem(direct.item)) return direct.item;
  const recent = await loadHistoryItems(['workout', 'strength'], { limit: 200 });
  if (!recent.ok) throw new Error(recent.error);
  return dedupeWorkoutItems(recent.items.filter(isWorkoutItem))
    .find((record) => record.id === requestedId || record.sourceRecordIds?.includes(requestedId)) ?? null;
}

function isWorkoutItem(item: LocalHistoryItem): boolean {
  return item.type === 'workout' || item.type === 'strength';
}

function objectValue(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function metersToKilometers(value: number | null): number | null { return value === null ? null : value / 1000; }
function metricNumber(metrics: Array<{ label: string; value: string }>, label: string): number | null {
  const value = metrics.find((metric) => metric.label.toLowerCase().includes(label))?.value;
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
function metricDurationSeconds(metrics: Array<{ label: string; value: string }>): number | null {
  const value = metrics.find((metric) => metric.label.toLowerCase().includes('duration'))?.value;
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}
function formatZoneDuration(seconds: number): string { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return minutes > 0 ? `${minutes}m ${remainder ? `${remainder}s` : ''}`.trim() : `${remainder}s`; }
function zoneRange(lower: number | null, upper: number | null): string { return lower == null ? `< ${upper == null ? '—' : upper + 1} bpm` : upper == null ? `${lower}+ bpm` : `${lower}–${upper} bpm`; }
function metricIcon(label: string): string {
  const value = label.toLowerCase();
  if (value.includes('distance')) return navigateOutline;
  if (value.includes('duration')) return timeOutline;
  if (value.includes('pace')) return speedometerOutline;
  if (value.includes('speed')) return flashOutline;
  if (value.includes('hr') || value.includes('heart')) return heartOutline;
  if (value.includes('calorie')) return flameOutline;
  if (value.includes('step')) return footstepsOutline;
  if (value.includes('cadence')) return syncOutline;
  if (value.includes('elevation')) return trendingUpOutline;
  if (value.includes('vo')) return statsChartOutline;
  if (value.includes('pool') || value.includes('length') || value.includes('stroke') || value.includes('swolf') || value.includes('sweat')) return waterOutline;
  return ellipseOutline;
}
function formatImportedAt(value: string | null): string { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : 'Not Available'; }

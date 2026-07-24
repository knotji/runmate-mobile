import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, barbellOutline, bicycleOutline, fitnessOutline, shareSocialOutline, walkOutline, waterOutline } from 'ionicons/icons';
import { SocialShareModal, type WorkoutShareData } from '@/components/SocialShareModal';
import { loadHistoryItems } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutDetail } from '@/lib/workoutDetail';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { restingHeartRateBaseline } from '@/lib/hrZones';
import type { UserProfile } from '@/types/profile';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import './WorkoutDetailPage.css';

const WorkoutDetailPage: React.FC = () => {
  const history = useHistory();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<LocalHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restingHr, setRestingHr] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [result, profileResult] = await Promise.all([loadHistoryItems(['workout', 'strength', 'sleep']), loadProfileFromSupabase()]);
    if (profileResult.ok) setProfile(profileResult.profile);
    if (!result.ok) setError(result.error);
    else {
      const sleepRestingHr = result.items
        .filter((record) => record.type === 'sleep')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 14)
        .map((record) => numberValue(objectValue(objectValue(record.data).extracted).restingHR));
      setRestingHr(restingHeartRateBaseline(sleepRestingHr) ?? (profileResult.ok ? profileResult.profile?.normalRestingHr ?? null : null));
      const requestedId = decodeURIComponent(id);
      const match = dedupeWorkoutItems(result.items.filter((record) => record.type === 'workout' || record.type === 'strength')).find((record) => record.id === requestedId || record.sourceRecordIds?.includes(requestedId));
      if (match) setItem(match);
      else setError('This workout record could not be found.');
    }
    setLoading(false);
  }, [id]);

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
          <IonButton slot="start" fill="clear" aria-label="Back To Activity" onClick={() => history.push('/tabs/activity')}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton>
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
          {!loading && error && <PageState kind="error" title="Workout Is Unavailable" detail={error} actionLabel="Back To Activity" onAction={() => history.push('/tabs/activity')} className="workout-detail-state" />}
          {detail && (
            <>
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
                  <div className="workout-metric-grid">{detail.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
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
function formatImportedAt(value: string | null): string { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : 'Not Available'; }

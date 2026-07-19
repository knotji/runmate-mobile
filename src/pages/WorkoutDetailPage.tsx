import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, barbellOutline, fitnessOutline, warningOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutDetail } from '@/lib/workoutDetail';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { restingHeartRateBaseline } from '@/lib/hrZones';
import type { UserProfile } from '@/types/profile';
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
  const detail = item ? buildWorkoutDetail(item, { maxHr: profile?.maxHr, restingHr }) : null;

  return (
    <IonPage>
      <IonHeader translucent className="workout-detail-header">
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label="Back To Activity" onClick={() => history.push('/tabs/activity')}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton>
          <IonTitle>Workout Detail</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="workout-detail-content">
        <main className="workout-detail-shell">
          {loading && <div className="workout-detail-state"><IonSpinner name="crescent" /><p>Loading Workout…</p></div>}
          {!loading && error && <div className="workout-detail-state"><IonIcon icon={warningOutline} /><p>{error}</p><button type="button" onClick={() => history.push('/tabs/activity')}>Back To Activity</button></div>}
          {detail && (
            <>
              <section className={`workout-hero workout-hero-${detail.tone}`}>
                <div className="workout-hero-icon"><IonIcon icon={detail.isStrength ? barbellOutline : fitnessOutline} /></div>
                <div><p>{detail.isStrength ? 'Strength Training' : 'Workout'}</p><h1>{detail.title}</h1><span>{detail.date}</span></div>
                {detail.intensity && <strong>{detail.intensity}</strong>}
              </section>

              {detail.heartRateZones && (
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
              )}

              <section className="workout-detail-section">
                <header><p>Workout Metrics</p><h2>Session Overview</h2></header>
                {detail.metrics.length > 0 ? (
                  <div className="workout-metric-grid">{detail.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
                ) : <p className="workout-empty-card">No structured workout metrics were provided for this session.</p>}
              </section>

              {detail.exercises.length > 0 && (
                <section className="workout-detail-section">
                  <header><p>Exercises</p><h2>Strength Work</h2></header>
                  <div className="exercise-list">{detail.exercises.map((exercise, index) => <div key={`${exercise.name}-${index}`}><span>{index + 1}</span><div><strong>{exercise.name}</strong><p>{exercise.detail}</p></div></div>)}</div>
                </section>
              )}

              {detail.insights.length > 0 && (
                <section className="workout-detail-section workout-guidance-section">
                  <details className="workout-guidance-disclosure">
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
      </IonContent>
    </IonPage>
  );
};

export default WorkoutDetailPage;

function objectValue(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function formatZoneDuration(seconds: number): string { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return minutes > 0 ? `${minutes}m ${remainder ? `${remainder}s` : ''}`.trim() : `${remainder}s`; }
function zoneRange(lower: number | null, upper: number | null): string { return lower == null ? `< ${upper == null ? '—' : upper + 1} bpm` : upper == null ? `${lower}+ bpm` : `${lower}–${upper} bpm`; }

import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, barbellOutline, fitnessOutline, warningOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutDetail } from '@/lib/workoutDetail';
import './WorkoutDetailPage.css';

const WorkoutDetailPage: React.FC = () => {
  const history = useHistory();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<LocalHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await loadHistoryItems(['workout', 'strength']);
    if (!result.ok) setError(result.error);
    else {
      const match = result.items.find((record) => record.id === decodeURIComponent(id));
      if (match) setItem(match);
      else setError('This workout record could not be found.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  const detail = item ? buildWorkoutDetail(item) : null;

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
                <section className="workout-detail-section">
                  <header><p>Coach Notes</p><h2>Session Guidance</h2></header>
                  <div className="workout-insight-list">{detail.insights.map((insight) => <div key={insight.label}><span>{insight.label}</span><p>{insight.value}</p></div>)}</div>
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

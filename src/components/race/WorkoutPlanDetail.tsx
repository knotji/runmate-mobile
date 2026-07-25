import { IonButton, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { formatRaceWorkoutMetric } from '@/lib/mobileRaceGoal';
import { translatePlanFieldToEnglish } from '@/lib/todayTrainingPlan';
import { shortDay } from '@/lib/raceGoalFormatting';
import type { WeekWorkout } from '@/types/race';

export function WorkoutPlanDetail({ workout, onClose }: { workout: WeekWorkout | null; onClose: () => void }) {
  const metrics = workout ? [
    workout.distanceKm != null && workout.distanceKm > 0 ? { label: 'Distance', value: `${workout.distanceKm} km` } : null,
    workout.durationMin != null && workout.durationMin > 0 ? { label: 'Duration', value: `${workout.durationMin} min` } : null,
    workout.targetPace && !/^n\/?a$/i.test(workout.targetPace.trim()) ? { label: 'Target Pace', value: translatePlanFieldToEnglish(workout.targetPace) } : null,
    workout.targetHR && !/^n\/?a$/i.test(workout.targetHR.trim()) ? { label: 'Target Effort', value: translatePlanFieldToEnglish(workout.targetHR) } : null,
  ].filter((metric): metric is { label: string; value: string } => Boolean(metric)) : [];

  return (
    <IonModal isOpen={Boolean(workout)} onDidDismiss={onClose} className="workout-plan-modal">
      <IonHeader className="workout-plan-header">
        <IonToolbar>
          <IonTitle>Session Details</IonTitle>
          <IonButton slot="end" fill="clear" aria-label="Close Session Details" onClick={onClose}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="workout-plan-content">
        {workout && <main className="workout-plan-shell">
          <header><p>{shortDay(workout.day)} · TRAINING PLAN</p><h1>{workout.workoutType}</h1><span>{formatRaceWorkoutMetric(workout)}</span></header>
          {metrics.length > 0 && <section className="workout-plan-metrics">{metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</section>}
          <section className="workout-plan-guidance">
            <p>COACH GUIDANCE</p>
            <h2>How To Approach It</h2>
            <div><strong>Session</strong><span>{workout.description || 'Follow the planned session at a comfortable, controlled effort.'}</span></div>
            {workout.purpose && <div><strong>Why It Matters</strong><span>{workout.purpose}</span></div>}
            {workout.adjustment && <div><strong>If You Need To Adjust</strong><span>{workout.adjustment}</span></div>}
          </section>
        </main>}
      </IonContent>
    </IonModal>
  );
}

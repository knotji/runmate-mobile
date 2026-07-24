import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, calendarOutline, checkmarkCircleOutline, closeCircleOutline, moonOutline, timeOutline } from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { buildWeeklyPlanCalendar, type CalendarDayStatus, type WeeklyCalendarDay } from '@/lib/weeklyPlanCalendar';
import { translatePlanFieldToEnglish } from '@/lib/todayTrainingPlan';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import './WeeklyPlanCalendarPage.css';

const WeeklyPlanCalendarPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setContext(await buildCoachContextFromSupabase());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could Not Load Your Weekly Plan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const days = useMemo(() => context ? buildWeeklyPlanCalendar(context) : null, [context]);
  const hasPlan = days?.some((day) => day.planned) ?? false;
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="weekly-plan-header"><IonToolbar>
      <button type="button" className="weekly-plan-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Weekly Plan</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="weekly-plan-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="weekly-plan-shell">
        <header className="weekly-plan-heading"><p>This Week</p><h1>Your Full Week At A Glance</h1><span>Every planned session this week, with what actually happened.</span></header>
        {loading && <PageDataSkeleton variant="race" label="Building Your Weekly Plan" />}
        {!loading && error && <PageState kind="error" title="Weekly Plan Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="weekly-plan-state" />}
        {!loading && !error && days && !hasPlan && (
          <PageState kind="empty" title="No Active Race Plan" detail="Set a Race Goal to generate a weekly training plan." actionLabel="Set A Race Goal" onAction={() => history.push('/race-goal')} className="weekly-plan-state" />
        )}
        {!loading && !error && days && hasPlan && (
          <section className="weekly-plan-list" aria-label="This week's planned sessions">
            {days.map((day) => <CalendarRow key={day.date} day={day} />)}
          </section>
        )}
      </main>
    </IonContent>
  </IonPage>;
};

function CalendarRow({ day }: { day: WeeklyCalendarDay }) {
  const { planned } = day;
  const description = planned ? translatePlanFieldToEnglish(planned.description || planned.workoutType) : null;
  return <article className={`weekly-plan-row status-${day.status}${day.isToday ? ' is-today' : ''}`}>
    <div className="weekly-plan-date">
      <strong>{day.weekdayLabel}</strong>
      <span>{formatDayNumber(day.date)}</span>
    </div>
    <div className="weekly-plan-detail">
      <p className="weekly-plan-type">{planned?.workoutType ?? 'No Plan'}</p>
      {description && description !== planned?.workoutType && <span className="weekly-plan-description">{description}</span>}
      {planned?.distanceKm != null && <span className="weekly-plan-meta">{planned.distanceKm} km{planned.targetPace ? ` · ${translatePlanFieldToEnglish(planned.targetPace)}` : ''}</span>}
    </div>
    <StatusBadge status={day.status} isToday={day.isToday} />
  </article>;
}

function StatusBadge({ status, isToday }: { status: CalendarDayStatus; isToday: boolean }) {
  if (status === 'rest') return <span className="weekly-plan-badge status-rest"><IonIcon icon={moonOutline} />Rest</span>;
  if (status === 'no_plan') return <span className="weekly-plan-badge status-no_plan">—</span>;
  if (status === 'completed') return <span className="weekly-plan-badge status-completed"><IonIcon icon={checkmarkCircleOutline} />Completed</span>;
  if (status === 'missed') return <span className="weekly-plan-badge status-missed"><IonIcon icon={closeCircleOutline} />Missed</span>;
  if (status === 'today_completed') return <span className="weekly-plan-badge status-completed"><IonIcon icon={checkmarkCircleOutline} />Done Today</span>;
  if (status === 'today_logged_different') return <span className="weekly-plan-badge status-logged_different">Logged Different</span>;
  if (status === 'today_pending') return <span className="weekly-plan-badge status-pending"><IonIcon icon={timeOutline} />Today</span>;
  return <span className="weekly-plan-badge status-upcoming"><IonIcon icon={calendarOutline} />{isToday ? 'Today' : 'Upcoming'}</span>;
}

function formatDayNumber(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export default WeeklyPlanCalendarPage;

import { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, calendarOutline, checkmarkCircleOutline, closeCircleOutline, moonOutline, timeOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { buildWeeklyPlanCalendar, type CalendarDayStatus, type WeeklyCalendarDay } from '@/lib/weeklyPlanCalendar';
import { translatePlanFieldToEnglish } from '@/lib/todayTrainingPlan';
import { useAsyncLoad } from '@/lib/hooks/useAsyncLoad';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { loadRecoveryContextStartupSnapshot } from '@/lib/recoveryStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import './WeeklyPlanCalendarPage.css';

const WeeklyPlanCalendarPage: React.FC = () => {
  const history = useHistory();
  const context = useCoachContextStore((state) => state.context);
  const [startupContext] = useState(() => loadRecoveryContextStartupSnapshot());
  const visibleContext = context ?? startupContext;

  const { loading, error, reload: load } = useAsyncLoad(async () => {
    await measurePerformanceDiagnostic(
      'weekly_plan',
      () => buildCoachContextFromSupabase(),
      () => ({ detail: 'Weekly plan context prepared' }),
    );
  }, 'Could Not Load Your Weekly Plan.');

  const days = useMemo(() => visibleContext ? buildWeeklyPlanCalendar(visibleContext) : null, [visibleContext]);
  const hasPlan = days?.some((day) => day.planned) ?? false;
  const overview = useMemo(() => days ? buildWeekOverview(days) : null, [days]);
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
        {loading && !visibleContext && <PageDataSkeleton variant="race" label="Building Your Weekly Plan" />}
        {!visibleContext && error && <PageState kind="error" title="Weekly Plan Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="weekly-plan-state" />}
        {days && !hasPlan && (
          <PageState kind="empty" title="No Active Race Plan" detail="Set a Race Goal to generate a weekly training plan." actionLabel="Set A Race Goal" onAction={() => history.push('/race-goal')} className="weekly-plan-state" />
        )}
        {days && hasPlan && (
          <>
          {overview && <section className="weekly-plan-overview" aria-label="Weekly plan overview">
            <div><strong>{overview.trainingDays}</strong><span>Training Days</span></div>
            <div><strong>{overview.distanceKm} km</strong><span>Planned Distance</span></div>
            <div><strong>{overview.done}</strong><span>Completed</span></div>
          </section>}
          <section className="weekly-plan-list" aria-label="This week's planned sessions">
            {days.map((day) => <CalendarRow key={day.date} day={day} />)}
          </section>
          </>
        )}
      </main>
    </IonContent>
  </IonPage>;
};

function CalendarRow({ day }: { day: WeeklyCalendarDay }) {
  const { planned } = day;
  const description = planned ? translatePlanFieldToEnglish(planned.description || planned.workoutType) : null;
  const targetPace = planned?.targetPace ? translatePlanFieldToEnglish(planned.targetPace) : null;
  const hasTargetPace = targetPace && targetPace.toLowerCase() !== 'n/a';
  const showTrainingMeta = day.status !== 'rest' && ((planned?.distanceKm ?? 0) > 0 || hasTargetPace);
  return <article className={`weekly-plan-row status-${day.status}${day.isToday ? ' is-today' : ''}`}>
    <div className="weekly-plan-date">
      <strong>{day.weekdayLabel}</strong>
      <span>{day.isToday ? `Today · ${formatDayNumber(day.date)}` : formatDayNumber(day.date)}</span>
    </div>
    <div className="weekly-plan-detail">
      <p className="weekly-plan-type">{planned?.workoutType ?? 'No Plan'}</p>
      {description && description !== planned?.workoutType && <span className="weekly-plan-description">{description}</span>}
      {showTrainingMeta && <span className="weekly-plan-meta">{(planned?.distanceKm ?? 0) > 0 ? `${planned?.distanceKm} km` : ''}{(planned?.distanceKm ?? 0) > 0 && hasTargetPace ? ' · ' : ''}{hasTargetPace ? targetPace : ''}</span>}
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

function buildWeekOverview(days: WeeklyCalendarDay[]) {
  return days.reduce((summary, day) => {
    if (day.planned && day.status !== 'rest') {
      summary.trainingDays += 1;
      summary.distanceKm += day.planned.distanceKm ?? 0;
    }
    if (day.status === 'completed' || day.status === 'today_completed') summary.done += 1;
    return summary;
  }, { trainingDays: 0, distanceKm: 0, done: 0 });
}

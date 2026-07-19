import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { alertCircleOutline, chevronForwardOutline, moonOutline, refreshOutline, sunnyOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase, type CoachContext } from '@/lib/buildCoachContext';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import { TodayTrainingPlanCard } from '@/components/TodayTrainingPlanCard';
import { formatClockMinutes, loadTonightWakeOverride, parseClockMinutes, sleepWindowForWake } from '@/lib/sleepWindow';
import { loadTonightWakePlan } from '@/lib/sleepWindowStorage';
import './RecoveryPage.css';

const RecoveryPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wakeOverrideMinutes, setWakeOverrideMinutes] = useState<number | null>(() => loadTonightWakeOverride());

  const loadRecovery = useCallback(async () => {
    setError(null);
    try {
      setContext(await buildCoachContextFromSupabase());
    } catch (loadError) {
      console.error('[recovery] load failed', loadError);
      setError('Unable to load your latest metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecovery(); }, [loadRecovery]);
  useIonViewWillEnter(() => {
    setWakeOverrideMinutes(loadTonightWakeOverride());
    void loadTonightWakePlan().then((plan) => setWakeOverrideMinutes(plan.minutes));
    void loadRecovery();
  });

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadRecovery();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader translucent className="recovery-header">
        <IonToolbar>
          <IonTitle>Recovery</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="recovery-content">
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" />
        </IonRefresher>
        <main className="recovery-shell metrics-only-shell">
          <header className="page-heading">
            <p className="eyebrow">Today's Overview</p>
          </header>
          {loading && <div className="state-panel"><IonSpinner name="crescent" /><p>Calculating your metrics…</p></div>}
          {!loading && error && (
            <div className="state-panel error-panel">
              <IonIcon icon={alertCircleOutline} />
              <p>{error}</p>
              <IonButton fill="outline" onClick={() => void loadRecovery()}><IonIcon slot="start" icon={refreshOutline} />Try Again</IonButton>
            </div>
          )}
          {!loading && !error && context?.recoverySystem && (
            <>
              <RecoveryDials recovery={context.recoverySystem} onSleepClick={() => history.push('/sleep')} />
              <TodayTrainingPlanCard context={context} />
              <RecoveryPlan recovery={context.recoverySystem} wakeOverrideMinutes={wakeOverrideMinutes} onOpen={() => history.push('/sleep-window')} />
            </>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

function RecoveryDials({ recovery, onSleepClick }: { recovery: RunMateRecoverySystem; onSleepClick: () => void }) {
  const recoveryAvailable = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating';
  return (
    <IonCard className="recovery-dials">
      <IonCardContent>
        <div className="dial-grid">
          <MetricDial label="Recovery" value={recoveryAvailable ? Math.round(recovery.overallScore) : null} max={100} tone="recovery" />
          <MetricDial label="Strain" value={recovery.strain.score} max={21} tone="strain" />
          <MetricDial label="Sleep" value={recovery.dataFreshness.status === 'today' ? recovery.sleepPerformance.score : null} max={100} tone="sleep" onClick={onSleepClick} />
        </div>
      </IonCardContent>
    </IonCard>
  );
}

function MetricDial({ label, value, max, tone, onClick }: { label: string; value: number | null; max: number; tone: 'recovery' | 'strain' | 'sleep'; onClick?: () => void }) {
  const percentage = value == null ? 0 : Math.max(0, Math.min(100, value / max * 100));
  const displayValue = value == null ? '—' : Math.round(value).toString();
  const content = (
    <>
      <span className="dial-label">{label}</span>
      <div
        className="dial-ring"
        style={{ background: `conic-gradient(var(--dial-color) ${percentage}%, rgba(255,255,255,.18) 0)` }}
        role="img"
        aria-label={`${label} ${displayValue} out of ${max}`}
      >
        <div className="dial-center"><strong>{displayValue}</strong><small>/{max}</small></div>
      </div>
    </>
  );
  return onClick
    ? <button type="button" className={`metric-dial metric-dial-button dial-${tone}`} onClick={onClick} aria-label="Open Sleep details">{content}</button>
    : <div className={`metric-dial dial-${tone}`}>{content}</div>;
}

export function TrainingGuidance({ recovery }: { recovery: RunMateRecoverySystem }) {
  const guidance: Array<{ title: string; body: string }> = [];
  if (recovery.scoreState !== 'stale' && recovery.scoreState !== 'unscorable') {
    if (recovery.overallScore < 34) guidance.push({ title: 'Recovery First', body: 'Keep today’s Strain low and prioritize recovery.' });
    else if (recovery.overallScore < 67) guidance.push({ title: 'Keep It Controlled', body: 'Your body is ready for moderate Strain. Avoid an all-out session.' });
    else guidance.push({ title: 'Ready For Planned Training', body: 'Your Recovery is in the green zone. Follow your planned training load.' });
  }
  if (recovery.strain.score >= 14 && recovery.overallScore < 67) guidance.push({ title: 'Strain Is Already High', body: 'Today’s load is high relative to your current Recovery.' });
  if (recovery.sleepPerformance.score < 70 && recovery.sleepPerformance.state !== 'unscorable') guidance.push({ title: 'Protect Tonight’s Sleep', body: 'Sleep Performance is below target. Keep your recommended bedtime.' });
  return (
    <section aria-labelledby="guidance-heading">
      <div className="section-heading"><div><p>Training Guidance</p><h2 id="guidance-heading">What To Watch Today</h2></div></div>
      <div className="guardrail-list">
        {guidance.map((item, index) => (
          <div className="guardrail" key={`${item.title}-${item.body}`}>
            <span>{index + 1}</span>
            <div className="guidance-copy"><strong>{item.title}</strong><p>{item.body}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecoveryPlan({ recovery, wakeOverrideMinutes, onOpen }: { recovery: RunMateRecoverySystem; wakeOverrideMinutes: number | null; onOpen: () => void }) {
  const sleep = recovery.sleepPerformance;
  const sleepNeedHours = Math.floor(sleep.sleepNeedMinutes / 60);
  const sleepNeedMinutes = sleep.sleepNeedMinutes % 60;
  const profileWakeMinutes = parseClockMinutes(sleep.targetWakeTime);
  const wakeMinutes = wakeOverrideMinutes ?? profileWakeMinutes;
  const window = wakeMinutes == null ? null : sleepWindowForWake(wakeMinutes, sleep.sleepNeedMinutes);
  const recoveryAvailable = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating';
  const { tomorrowHeadline, tomorrowSummary } = !recoveryAvailable
    ? { tomorrowHeadline: 'Focus On Tonight', tomorrowSummary: 'Recovery isn’t scored yet — hitting your Sleep Need tonight is the best lever you have for tomorrow.' }
    : recovery.overallScore >= 67
      ? { tomorrowHeadline: 'On Track', tomorrowSummary: 'Hitting your Sleep Need tonight should hold this Recovery steady for tomorrow.' }
      : recovery.overallScore >= 34
        ? { tomorrowHeadline: 'Sleep Is The Lever', tomorrowSummary: 'Meeting your Sleep Need tonight is the fastest way to lift tomorrow’s Recovery.' }
        : { tomorrowHeadline: 'Prioritize Sleep Tonight', tomorrowSummary: 'Recovery is low — tonight’s sleep matters more than usual before adding any intensity tomorrow.' };
  return (
    <section aria-labelledby="plan-heading" className="loop-section">
      <div className="section-heading"><div><p>Tonight</p><h2 id="plan-heading">Your Sleep Plan</h2></div></div>
      <button type="button" className="loop-card primary-loop sleep-window-link" onClick={onOpen}>
        <IonIcon icon={moonOutline} />
        <div className="sleep-schedule">
          <span>Tonight</span>
          <h3>{window ? `In Bed By ${formatClockMinutes(window.idealInBedMinutes)}` : `Sleep ${sleepNeedHours}h ${sleepNeedMinutes}m`}</h3>
          {window ? (
            <div className="sleep-schedule-details">
              <p className="sleep-times"><span>Window</span><strong>{formatClockMinutes(window.windowStartMinutes)}–{formatClockMinutes(window.windowEndMinutes)}</strong><i aria-hidden="true" /><span>Wake</span><strong>{formatClockMinutes(window.wakeMinutes)}</strong></p>
              <p className="sleep-need-badge">Sleep Need <strong>{sleepNeedHours}h {sleepNeedMinutes}m</strong></p>
            </div>
          ) : <p className="sleep-schedule-fallback">Set a consistent wake time to unlock a personalized bedtime.</p>}
        </div>
        <IonIcon className="sleep-window-chevron" icon={chevronForwardOutline} />
      </button>
      <details className="recovery-plan-details">
        <summary>Tomorrow And Load</summary>
      <div className="loop-card">
        <IonIcon icon={sunnyOutline} />
        <div><span>Tomorrow</span><h3>{tomorrowHeadline}</h3><p>{tomorrowSummary}</p></div>
      </div>
      <div className="day-load-line"><span>Today’s Strain</span><strong>{recovery.strain.score.toFixed(1)}/21 · {strainLabel(recovery.strain.level)}</strong></div>
      </details>
    </section>
  );
}

function strainLabel(level: RunMateRecoverySystem['strain']['level']): string {
  return { light: 'Light', moderate: 'Moderate', high: 'High', all_out: 'All Out' }[level];
}

export default RecoveryPage;

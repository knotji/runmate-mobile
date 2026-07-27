import { useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline, moonOutline, refreshOutline, timeOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import {
  formatClockMinutes,
  formatTimeInput,
  loadTonightWakeOverride,
  parseClockMinutes,
  parseTimeInput,
  recommendedSleepCycleCount,
  SLEEP_CYCLE_OPTIONS,
  sleepCyclePlanForWake,
  sleepWindowForWake,
  type SleepCycleCount,
} from '@/lib/sleepWindow';
import { deleteTonightWakePlan, loadDefaultWakeTime, loadTonightWakePlan, saveTonightWakePlan } from '@/lib/sleepWindowStorage';
import { loadRecoveryContextStartupSnapshot } from '@/lib/recoveryStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import './SleepWindowPage.css';

const SleepWindowPage: React.FC = () => {
  const history = useHistory();
  const context = useCoachContextStore((state) => state.context);
  const [startupContext] = useState(() => loadRecoveryContextStartupSnapshot());
  const visibleContext = context ?? startupContext;
  const [loading, setLoading] = useState(() => visibleContext == null);
  const [wakeOverride, setWakeOverride] = useState<number | null>(() => {
    try { return loadTonightWakeOverride(); } catch { return null; }
  });
  const [savedWake, setSavedWake] = useState<number | null>(null);
  const [defaultWake, setDefaultWake] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCycles, setSelectedCycles] = useState<SleepCycleCount | null>(null);
  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const [, storedWake, storedDefaultWake] = await measurePerformanceDiagnostic(
        'sleep_window',
        () => Promise.all([buildCoachContextFromSupabase(), loadTonightWakePlan(), loadDefaultWakeTime()]),
        () => ({ detail: 'Recovery context and wake plan prepared' }),
      );
      setWakeOverride(storedWake.minutes);
      setSavedWake(storedWake.synced ? storedWake.minutes : null);
      setDefaultWake(storedDefaultWake);
    }
    catch (error) {
      if (!visibleContext) setLoadError(error instanceof Error ? error.message : 'Could Not Build Your Sleep Window.');
    }
    finally { setLoading(false); }
  }, [visibleContext]);
  useIonViewWillEnter(() => { if (!visibleContext) setLoading(true); void load(); });

  const sleep = visibleContext?.recoverySystem?.sleepPerformance;
  const derivedWake = parseClockMinutes(sleep?.targetWakeTime ?? null);
  const profileWake = defaultWake ?? derivedWake;
  const wakeMinutes = wakeOverride ?? profileWake;
  const window = wakeMinutes != null && sleep ? sleepWindowForWake(wakeMinutes, sleep.sleepNeedMinutes) : null;
  const cycleCount = sleep ? selectedCycles ?? recommendedSleepCycleCount(sleep.sleepNeedMinutes) : null;
  const cyclePlan = wakeMinutes != null && sleep && cycleCount
    ? sleepCyclePlanForWake(wakeMinutes, cycleCount, sleep.sleepNeedMinutes)
    : null;

  const changeWake = (value: string) => {
    const minutes = parseTimeInput(value);
    if (minutes == null) return;
    setWakeOverride(minutes);
    setSaveError(null);
  };

  const saveForTonight = async () => {
    if (wakeMinutes == null || saving) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveTonightWakePlan(wakeMinutes);
    setSaving(false);
    if (!result.ok) { setSaveError(result.error); return; }
    setWakeOverride(wakeMinutes);
    setSavedWake(wakeMinutes);
  };

  const restoreProfileWake = async () => {
    setSaving(true);
    setSaveError(null);
    const result = await deleteTonightWakePlan();
    setSaving(false);
    if (!result.ok) { setSaveError(result.error); return; }
    setWakeOverride(null);
    setSavedWake(null);
  };

  return (
    <IonPage>
      <IonHeader translucent className="sleep-window-header"><IonToolbar>
        <IonButton slot="start" fill="clear" aria-label="Back To Recovery" onClick={() => history.push('/tabs/recovery')}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton>
        <IonTitle>Sleep Window</IonTitle>
      </IonToolbar></IonHeader>
      <IonContent fullscreen className="sleep-window-content"><main className="sleep-window-shell">
        {loading && <PageDataSkeleton variant="sleep" label="Preparing Your Sleep Window" />}
        {!loading && loadError && <PageState kind="error" title="Sleep Window Is Unavailable" detail={loadError} actionLabel="Try Again" onAction={() => { setLoading(true); void load(); }} className="sleep-window-state" />}
        {!loading && !loadError && window && sleep && <>
          <header className="sleep-window-intro"><p>Tonight</p><h1>Plan Around Your Wake Time</h1><span>Your Sleep Need sets the target. Sleep cycles are shown only as an estimate.</span></header>
          <section className="sleep-window-hero">
            <IonIcon icon={moonOutline} />
            <p>Recommended Sleep Window</p>
            <h2>{formatClockMinutes(window.windowStartMinutes)}–{formatClockMinutes(window.windowEndMinutes)}</h2>
            <span>Aim To Be Asleep By {formatClockMinutes(window.asleepMinutes)}</span>
          </section>
          <section className="sleep-window-card">
            <div className="sleep-window-card-heading"><IonIcon icon={timeOutline} /><div><p>Tomorrow</p><h2>Choose Your Wake Time</h2></div></div>
            <label className="sleep-window-picker"><span>Wake Time</span><input type="time" value={formatTimeInput(window.wakeMinutes)} onChange={(event) => changeWake(event.target.value)} /></label>
            {wakeOverride != null && <p className="wake-source-note"><strong>Tonight Override</strong><span>This time replaces your default for tonight only.</span></p>}
            {wakeOverride != null && profileWake != null && <button type="button" className="profile-wake-button" disabled={saving} onClick={() => void restoreProfileWake()}><IonIcon icon={refreshOutline} />Use {defaultWake != null ? 'Profile' : 'Typical'} Wake Time · {formatClockMinutes(profileWake)}</button>}
            {saveError && <p className="sleep-window-save-error">{saveError}</p>}
            <button type="button" className={`save-tonight-button ${savedWake === wakeMinutes ? 'saved' : ''}`} disabled={saving || savedWake === wakeMinutes} onClick={() => void saveForTonight()}>
              {savedWake === wakeMinutes && <IonIcon icon={checkmarkCircleOutline} />}
              {saving ? 'Saving…' : savedWake === wakeMinutes ? 'Saved For Tonight' : 'Save For Tonight'}
            </button>
            <p className="tonight-only-note">{savedWake === wakeMinutes ? 'Saved to your account for tonight only.' : 'This change applies to tonight only.'}</p>
          </section>
          {cyclePlan && <section className="sleep-cycle-planner" aria-labelledby="cycle-planner-title">
            <div className="cycle-planner-heading">
              <div><p>Cycle Planner</p><h2 id="cycle-planner-title">Choose Your Sleep Cycles</h2></div>
              <span className={`cycle-status ${cyclePlan.adequacy}`}>{cycleAdequacyLabel(cyclePlan.differenceMinutes)}</span>
            </div>
            <div className="cycle-options" role="group" aria-label="Estimated sleep cycles">
              {SLEEP_CYCLE_OPTIONS.map((count) => {
                const minutes = count * 90;
                return <button type="button" key={count} className={cycleCount === count ? 'selected' : ''} aria-pressed={cycleCount === count} onClick={() => setSelectedCycles(count)}>
                  <strong>{count}</strong><span>{formatDuration(minutes)}</span>
                </button>;
              })}
            </div>
            <div className="cycle-plan-result">
              <div><span>In Bed</span><strong>{formatClockMinutes(cyclePlan.inBedMinutes)}</strong></div>
              <i aria-hidden="true">→</i>
              <div><span>Wake</span><strong>{formatClockMinutes(cyclePlan.wakeMinutes)}</strong></div>
            </div>
            <p>Includes about 20 minutes to fall asleep. A 90-minute cycle is an estimate; your Sleep Need remains the main target.</p>
          </section>}
          <section className="sleep-window-summary">
            <div><span>Sleep Need</span><strong>{Math.floor(sleep.sleepNeedMinutes / 60)}h {sleep.sleepNeedMinutes % 60}m</strong></div>
            <div><span>Suggested Plan</span><strong>{recommendedSleepCycleCount(sleep.sleepNeedMinutes)} cycles</strong></div>
            <p>Sleep cycles vary throughout the night. The window prioritizes your total Sleep Need rather than forcing fixed 90-minute blocks.</p>
          </section>
          <details className="sleep-cycle-details">
            <summary><span><small>Sleep Cycle Detail</small>About Your Sleep Cycles</span></summary>
            <div className="sleep-cycle-content">
              <p className="sleep-cycle-intro">A cycle commonly lasts around 80–100 minutes, but its length and stages naturally change throughout the night.</p>
              <ol>
                <li><span>Early Night</span><strong>Cycles 1–2</strong><p>Deep Sleep is often more prominent and supports physical restoration.</p></li>
                <li><span>Middle Of The Night</span><strong>Cycles 3–4</strong><p>Light Sleep and REM usually become a larger part of each cycle.</p></li>
                <li><span>Late Night</span><strong>Cycles 5–6</strong><p>REM is often longer and supports memory, learning, and emotional processing.</p></li>
              </ol>
              <p className="sleep-cycle-note">This is planning guidance, not a measured Sleep Stage timeline. Your completed night appears in Sleep Details after data is available.</p>
            </div>
          </details>
        </>}
        {!loading && !loadError && !window && <PageState kind="empty" title="Wake Time Needed" detail="Add a consistent wake time before RunMate builds your Sleep Window." className="sleep-window-state" />}
      </main></IonContent>
    </IonPage>
  );
};

export default SleepWindowPage;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function cycleAdequacyLabel(differenceMinutes: number): string {
  if (differenceMinutes >= 0) return differenceMinutes === 0 ? 'Meets Sleep Need' : `${formatDuration(differenceMinutes)} extra`;
  return Math.abs(differenceMinutes) <= 30 ? `${formatDuration(Math.abs(differenceMinutes))} close` : `${formatDuration(Math.abs(differenceMinutes))} short`;
}

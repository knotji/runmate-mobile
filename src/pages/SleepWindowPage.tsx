import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, moonOutline, refreshOutline, timeOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase, type CoachContext } from '@/lib/buildCoachContext';
import {
  clearTonightWakeOverride,
  formatClockMinutes,
  formatTimeInput,
  loadTonightWakeOverride,
  parseClockMinutes,
  parseTimeInput,
  saveTonightWakeOverride,
  sleepWindowForWake,
} from '@/lib/sleepWindow';
import './SleepWindowPage.css';

const SleepWindowPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [wakeOverride, setWakeOverride] = useState<number | null>(() => loadTonightWakeOverride());
  const load = useCallback(async () => {
    try { setContext(await buildCoachContextFromSupabase()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sleep = context?.recoverySystem?.sleepPerformance;
  const profileWake = parseClockMinutes(sleep?.targetWakeTime ?? null);
  const wakeMinutes = wakeOverride ?? profileWake;
  const window = wakeMinutes != null && sleep ? sleepWindowForWake(wakeMinutes, sleep.sleepNeedMinutes) : null;

  const changeWake = (value: string) => {
    const minutes = parseTimeInput(value);
    if (minutes == null) return;
    saveTonightWakeOverride(minutes);
    setWakeOverride(minutes);
  };

  const useProfileWake = () => {
    clearTonightWakeOverride();
    setWakeOverride(null);
  };

  return (
    <IonPage>
      <IonHeader translucent className="sleep-window-header"><IonToolbar>
        <IonButton slot="start" fill="clear" aria-label="Back To Recovery" onClick={() => history.push('/tabs/recovery')}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton>
        <IonTitle>Sleep Window</IonTitle>
      </IonToolbar></IonHeader>
      <IonContent fullscreen className="sleep-window-content"><main className="sleep-window-shell">
        {loading && <div className="sleep-window-state"><IonSpinner name="crescent" />Calculating Your Sleep Window…</div>}
        {!loading && window && sleep && <>
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
            {wakeOverride != null && profileWake != null && <button type="button" className="profile-wake-button" onClick={useProfileWake}><IonIcon icon={refreshOutline} />Use Profile Time · {formatClockMinutes(profileWake)}</button>}
            <p className="tonight-only-note">This change applies to tonight only.</p>
          </section>
          <section className="sleep-window-summary">
            <div><span>Sleep Need</span><strong>{Math.floor(sleep.sleepNeedMinutes / 60)}h {sleep.sleepNeedMinutes % 60}m</strong></div>
            <div><span>Estimated Cycles</span><strong>{window.estimatedCyclesLow}–{window.estimatedCyclesHigh}</strong></div>
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
        {!loading && !window && <div className="sleep-window-state">A consistent wake time is needed before we can build your Sleep Window.</div>}
      </main></IonContent>
    </IonPage>
  );
};

export default SleepWindowPage;

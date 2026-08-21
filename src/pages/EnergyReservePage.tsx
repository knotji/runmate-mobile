import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, useIonViewWillEnter, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, batteryHalfOutline, chevronForwardOutline, fitnessOutline, informationCircleOutline, nutritionOutline, partlySunnyOutline } from 'ionicons/icons';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { PageState } from '@/components/PageState';
import { DataFreshnessStatus } from '@/components/DataFreshnessStatus';
import { buildRecoveryPageContextFromSupabase } from '@/lib/coachContextService';
import type { CoachContext } from '@/lib/buildCoachContext';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { buildEnergyReserveFromContext } from '@/lib/energyReserve';
import { loadRecoveryContextStartupSnapshot } from '@/lib/recoveryStartupCache';
import { loadDailyStrainCheckIn, type DailyStrainCheckIn } from '@/lib/strainContext';
import { navigateBackOr } from '@/lib/navigationBack';
import './EnergyReservePage.css';

const EnergyReservePage: React.FC = () => {
  const history = useHistory();
  const sharedContext = useCoachContextStore((state) => state.context);
  const [startupContext] = useState(() => loadRecoveryContextStartupSnapshot());
  const [localContext, setLocalContext] = useState<CoachContext | null>(null);
  const visibleContext = sharedContext ?? localContext ?? startupContext;
  const [loading, setLoading] = useState(() => visibleContext == null);
  const [error, setError] = useState<string | null>(null);
  const date = visibleContext?.todayDate ?? '';
  const [checkIn, setCheckIn] = useState<DailyStrainCheckIn | null>(() => date ? loadDailyStrainCheckIn(date) : null);

  const load = useCallback(async (force = false) => {
    if (!visibleContext) setLoading(true);
    setError(null);
    try { setLocalContext(await buildRecoveryPageContextFromSupabase({ force })); }
    // Always record a failed refresh, even when cached context already lets the
    // page render — a pull-to-refresh that silently fails (no error, no visible
    // change) is indistinguishable from one that succeeded with nothing new.
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could Not Load Energy Reserve.'); }
    finally { setLoading(false); }
  }, [visibleContext]);

  useIonViewWillEnter(() => { void load(false); });
  useEffect(() => {
    if (!date) return;
    const update = () => setCheckIn(loadDailyStrainCheckIn(date));
    update();
    window.addEventListener('runmate:strain-check-in-updated', update);
    return () => window.removeEventListener('runmate:strain-check-in-updated', update);
  }, [date]);

  const energy = useMemo(() => visibleContext ? buildEnergyReserveFromContext(visibleContext, checkIn) : null, [checkIn, visibleContext]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(true); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="energy-header"><IonToolbar>
      <button type="button" className="energy-back" aria-label="Back To Today" onClick={() => navigateBackOr(history, '/tabs/today')}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Energy Reserve</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="energy-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="energy-shell">
        <header className="energy-intro"><p>Energy Today</p><h1>See What You Have Left</h1><span>A simple estimate from today’s Recovery, recorded Strain, and context you confirmed.</span></header>
        {loading && !energy && <PageDataSkeleton variant="detail" label="Building Energy Reserve" />}
        {!loading && error && !energy && <PageState kind="error" title="Energy Reserve Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load(true)} />}
        {energy && <>
          {error && <DataFreshnessStatus status="fallback" label="Saved Data" detail="Refresh unavailable · Showing your last loaded Energy Reserve" onRetry={() => void load(true)} variant="panel" />}
          <section className={`energy-hero is-${energy.level}`}>
            <div className="energy-hero-top"><span className="energy-hero-icon"><IonIcon icon={batteryHalfOutline} /></span><span><small>Energy Remaining</small><strong>{energy.label}</strong></span><b><span>{energy.score ?? '—'}</span><small>/100</small></b></div>
            <div className="energy-detail-track" aria-label={energy.available ? `${energy.score} percent Energy remaining` : 'Energy unavailable'}><i style={{ width: `${energy.score ?? 0}%` }} /></div>
            <p>{energy.summary}</p>
          </section>

          {energy.available && <section className="energy-card">
            <header className="energy-card-heading"><div><p>Transparent Estimate</p><h2>How Today Changed</h2></div><span><small>Remaining</small><strong>{energy.score ?? '—'}</strong></span></header>
            <div className="energy-breakdown" aria-label="Energy calculation breakdown">
              <Breakdown icon={partlySunnyOutline} label="Start" detail="Recovery" value={energy.startingRecovery == null ? '—' : `+${energy.startingRecovery}`} />
              <button type="button" aria-label={`Recorded Strain used ${energy.strainDrain} points. Open Strain Detail.`} onClick={() => history.push('/strain')}><Breakdown icon={fitnessOutline} label="Used" detail="Strain" value={`−${energy.strainDrain}`} /></button>
              <Breakdown icon={informationCircleOutline} label="Context" detail="Stress + Heat" value={`−${energy.contextDrain}`} />
            </div>
            <p className={`energy-context-note ${energy.context.length ? 'has-context' : ''}`}>{energy.context.length ? energy.context.join(' · ') : 'No confirmed stress or heat drain today.'}</p>
          </section>}

          <button type="button" className={`energy-fuel is-${energy.fuel.status}`} onClick={() => history.push('/tabs/move')}>
            <span><IonIcon icon={nutritionOutline} /></span><div><p>Fuel Status</p><h2>{energy.fuel.label}</h2><small>{energy.fuel.summary}</small></div><IonIcon icon={chevronForwardOutline} />
          </button>

          <section className="energy-action"><p>One Useful Move</p><h2>{energy.action.title}</h2><span>{energy.action.detail}</span></section>

          <details className="energy-method"><summary>How WholeMate estimates this</summary><p>Energy Reserve is a WholeMate guidance estimate, not a medical or biological energy measurement. It starts with today’s Recovery and subtracts recorded Strain plus stress or heat that you explicitly confirm. Fuel changes the guidance, not the number. Heart rate alone never creates passive Strain.</p></details>
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function Breakdown({ icon, label, detail, value }: { icon: string; label: string; detail: string; value: string }) {
  return <div className="energy-breakdown-item"><span><IonIcon icon={icon} /></span><strong>{value}</strong><small>{label}</small><em>{detail}</em></div>;
}

export default EnergyReservePage;

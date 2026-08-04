import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline, fitnessOutline, informationCircleOutline, moonOutline, pulseOutline, trendingDownOutline, warningOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { todayBangkokDateKey } from '@/lib/date';
import { buildFitnessAge, type FitnessAgeResult, type FitnessAgeSignal } from '@/lib/fitnessAge';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import type { UserProfile } from '@/types/profile';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { PageState } from '@/components/PageState';
import './FitnessAgePage.css';

const FitnessAgePage: React.FC = () => {
  const history = useHistory();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<LocalHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeLoad = useRef<Promise<void> | null>(null);
  const load = useCallback(async () => {
    if (activeLoad.current) return activeLoad.current;
    const operation = (async () => {
      setLoading(true); setError(null);
      const [profileResult, historyResult] = await Promise.all([
        loadProfileFromSupabase(),
        loadHistoryItems(['sleep', 'workout', 'strength'], { limit: 1000 }),
      ]);
      if (!profileResult.ok) setError(('message' in profileResult && profileResult.message) || 'Could Not Load Your Profile.');
      else if (!historyResult.ok) setError(historyResult.error);
      else { setProfile(profileResult.profile ?? null); setItems(historyResult.items); }
      setLoading(false);
    })().finally(() => { activeLoad.current = null; });
    activeLoad.current = operation;
    return operation;
  }, []);
  useEffect(() => { void load(); }, [load]);
  const result = useMemo(() => items ? buildFitnessAge(profile, items, todayBangkokDateKey()) : null, [items, profile]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="fitness-age-header"><IonToolbar>
      <button type="button" className="fitness-age-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Fitness Age</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="fitness-age-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="fitness-age-shell">
        <header className="fitness-age-intro"><p>Long-Term Fitness</p><h1>Your Fitness, Made Easier To Read</h1><span>A transparent RunMate estimate from your recent cardio fitness, sleep, recovery, and training consistency.</span></header>
        {loading && !result && <PageDataSkeleton variant="trends" label="Building Your Fitness Age" />}
        {!loading && error && !result && <PageState kind="error" title="Fitness Age Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} />}
        {result && <FitnessAgeBody result={result} onProfile={() => history.push('/profile-settings')} />}
      </main>
    </IonContent>
  </IonPage>;
};

function FitnessAgeBody({ result, onProfile }: { result: FitnessAgeResult; onProfile: () => void }) {
  if (result.status === 'building') return <>
    <section className="fitness-age-hero is-building" aria-labelledby="fitness-age-building-title">
      <div className="fitness-age-ring"><IonIcon icon={fitnessOutline} /><strong>{result.coveragePercent}%</strong><span>coverage</span></div>
      <div><p>Building Your Baseline</p><h2 id="fitness-age-building-title">Fitness Age Is Not Ready Yet</h2><span>RunMate waits for enough trustworthy history instead of guessing an age.</span></div>
    </section>
    <section className="fitness-age-card"><header><IonIcon icon={warningOutline} /><div><p>Still Needed</p><h2>Complete Your Baseline</h2></div></header><ul className="fitness-age-missing">{result.missing.map((item) => <li key={item}>{item}</li>)}</ul>{result.missing.some((item) => /Birth date|VO₂ Max/.test(item)) && <button type="button" className="fitness-age-action" onClick={onProfile}>Review Profile</button>}</section>
    {result.signals.length > 0 && <Signals signals={result.signals} />}
    <MethodNote />
  </>;
  const younger = (result.ageDifference ?? 0) < 0;
  const same = result.ageDifference === 0;
  return <>
    <section className="fitness-age-hero" aria-labelledby="fitness-age-result-title">
      <div className="fitness-age-ring"><strong>{result.fitnessAge}</strong><span>Fitness Age</span></div>
      <div><p>{result.confidence} Confidence · {result.coveragePercent}% Coverage</p><h2 id="fitness-age-result-title">{same ? 'Aligned With Your Age' : younger ? `${Math.abs(result.ageDifference!)} Years Younger` : `${result.ageDifference} Years Older`}</h2><span>Compared with your chronological age of {result.chronologicalAge}.</span></div>
    </section>
    <section className="fitness-age-summary" aria-label="Fitness age summary"><div><span>Actual Age</span><strong>{result.chronologicalAge}</strong></div><div><span>Fitness Age</span><strong>{result.fitnessAge}</strong></div><div><span>History</span><strong>{result.historySpanDays}<small> days</small></strong></div></section>
    <Signals signals={result.signals} />
    <MethodNote />
  </>;
}

function Signals({ signals }: { signals: FitnessAgeSignal[] }) {
  return <section className="fitness-age-card"><header><IonIcon icon={pulseOutline} /><div><p>Your Signals</p><h2>What Shapes This Estimate</h2></div></header><div className="fitness-age-signals">{signals.map((signal) => <article className={`is-${signal.direction}`} key={signal.key}><IonIcon icon={signal.direction === 'helping' ? checkmarkCircleOutline : signal.direction === 'holding' ? trendingDownOutline : signal.key === 'sleep' ? moonOutline : informationCircleOutline} /><div><strong>{signal.label}</strong><span>{signal.value}</span><small>{signal.detail}</small></div></article>)}</div></section>;
}

function MethodNote() { return <section className="fitness-age-method"><IonIcon icon={informationCircleOutline} /><div><strong>RunMate Estimate · Beta</strong><span>This is a fitness and lifestyle trend, not biological age or medical advice. It updates as your long-term data improves.</span></div></section>; }

export default FitnessAgePage;


import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonAlert, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, barbellOutline, checkmarkCircleOutline, globeOutline, heartOutline, moonOutline, scaleOutline } from 'ionicons/icons';
import { defaultProfile, type UserProfile } from '@/types/profile';
import { loadProfileFromSupabase, saveProfileToSupabase } from '@/lib/profileStorage';
import { applyProfileSettings, birthDateBounds, DAYS, profileToSettingsDraft, validateProfileSettings, type ProfileSettingsDraft } from '@/lib/profileSettings';
import { loadHistoryItems } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { findHighestObservedHeartRate, type ObservedHeartRate } from '@/lib/observedHeartRate';
import { getHeartRateZoneBoundaries, restingHeartRateBaseline, type HeartRateZoneBoundary } from '@/lib/hrZones';
import { loadDefaultWakeTime, saveDefaultWakeTime } from '@/lib/sleepWindowStorage';
import { formatTimeInput, parseTimeInput } from '@/lib/sleepWindow';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { loadProfileSettingsStartupSnapshot, saveProfileSettingsStartupSnapshot } from '@/lib/profileSettingsStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import './ProfileSettingsPage.css';

const emptyDraft: ProfileSettingsDraft = { birthDate: '', vo2max: '', maxHr: '', weightKg: '', weeklyTrainingDays: '', preferredLongRunDay: '', preferredRunTime: '', defaultWakeTime: '' };

const ProfileSettingsPage: React.FC = () => {
  const history = useHistory();
  const [startupSnapshot] = useState(() => loadProfileSettingsStartupSnapshot());
  const startupDraft = startupSnapshot
    ? { ...profileToSettingsDraft(startupSnapshot.profile), defaultWakeTime: startupSnapshot.defaultWakeTime == null ? '' : formatTimeInput(startupSnapshot.defaultWakeTime) }
    : emptyDraft;
  const [profile, setProfile] = useState<UserProfile | null>(() => startupSnapshot?.profile ?? null);
  const [draft, setDraft] = useState(startupDraft);
  const [savedDraft, setSavedDraft] = useState(startupDraft);
  const [loading, setLoading] = useState(() => startupSnapshot === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [observedHr, setObservedHr] = useState<ObservedHeartRate | null>(() => startupSnapshot?.observedHr ?? null);
  const [restingHrBaseline, setRestingHrBaseline] = useState<number | null>(() => startupSnapshot?.restingHrBaseline ?? null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const hasUserEditedRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    const [result, historyResult, defaultWake] = await measurePerformanceDiagnostic(
      'profile_settings',
      () => Promise.all([
        loadProfileFromSupabase(),
        loadHistoryItems(['workout', 'strength', 'sleep'], { limit: 120 }),
        loadDefaultWakeTime(),
      ]),
      (value) => ({
        status: value[0].ok ? 'success' : 'failed',
        detail: value[1].ok ? `${value[1].items.length} profile support records prepared` : value[1].error,
      }),
    );
    const nextObservedHr = historyResult.ok ? findHighestObservedHeartRate(historyResult.items) : startupSnapshot?.observedHr ?? null;
    const nextRestingHr = historyResult.ok ? restingHeartRateBaseline(historyResult.items.map(recentRestingHr)) : startupSnapshot?.restingHrBaseline ?? null;
    if (historyResult.ok) {
      setObservedHr(nextObservedHr);
      setRestingHrBaseline(nextRestingHr);
    }
    if (!result.ok) setError(('message' in result && result.message) || 'Could Not Load Your Profile.');
    else {
      const next = result.profile ?? { ...defaultProfile, timezone: 'Asia/Bangkok' };
      setProfile(next);
      const nextDraft = { ...profileToSettingsDraft(next), defaultWakeTime: defaultWake == null ? '' : formatTimeInput(defaultWake) };
      if (!hasUserEditedRef.current) {
        setDraft(nextDraft);
        setSavedDraft(nextDraft);
      }
      saveProfileSettingsStartupSnapshot({
        profile: next,
        observedHr: nextObservedHr,
        restingHrBaseline: nextRestingHr,
        defaultWakeTime: defaultWake,
      });
    }
    setLoading(false);
  }, [startupSnapshot]);
  useEffect(() => { void load(); }, [load]);

  const update = (key: keyof ProfileSettingsDraft, value: string) => { hasUserEditedRef.current = true; setDraft((current) => ({ ...current, [key]: value })); setSaved(false); setError(null); };
  const save = async () => {
    if (!profile || saving) return;
    const validation = validateProfileSettings(draft);
    if (validation) { setError(validation); return; }
    setSaving(true); setError(null); setSaved(false);
    try {
      const next = applyProfileSettings(profile, draft);
      const wakeMinutes = draft.defaultWakeTime ? parseTimeInput(draft.defaultWakeTime) : null;
      const [result, wakeResult] = await Promise.all([saveProfileToSupabase(next), saveDefaultWakeTime(wakeMinutes)]);
      if (!result.ok) throw new Error(('message' in result && result.message) || 'Could Not Save Your Profile.');
      if (!wakeResult.ok) throw new Error(wakeResult.error);
      const nextDraft = { ...profileToSettingsDraft(next), defaultWakeTime: draft.defaultWakeTime };
      setProfile(next); setDraft(nextDraft); setSavedDraft(nextDraft); setSaved(true);
      hasUserEditedRef.current = false;
      saveProfileSettingsStartupSnapshot({
        profile: next,
        observedHr,
        restingHrBaseline,
        defaultWakeTime: wakeMinutes,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could Not Save Your Profile.');
    } finally { setSaving(false); }
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  useEffect(() => {
    if (!hasChanges) return;
    return history.block(() => { setDiscardOpen(true); return false; });
  }, [hasChanges, history]);

  const maxHrSource = draft.maxHr && observedHr?.bpm === Number(draft.maxHr) ? 'Highest Observed' : 'Manual';
  const birthDateRange = birthDateBounds();
  const weightSource = draft.weightKg !== savedDraft.weightKg || profile?.fieldSources?.weightKg !== 'health_connect' ? 'Manual' : 'Samsung Health';
  const maxHrNumber = Number(draft.maxHr);
  const zoneBoundaries = draft.maxHr && restingHrBaseline != null
    ? getHeartRateZoneBoundaries(maxHrNumber, restingHrBaseline)
    : null;

  return <IonPage>
    <IonHeader translucent className="profile-settings-header"><IonToolbar>
      <button type="button" className="profile-settings-back" aria-label="Back To Settings And Data" onClick={() => history.push('/tabs/settings')}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Profile & Settings</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="profile-settings-content"><main className="profile-settings-shell">
      <header className="profile-settings-intro"><p>Your RunMate</p><h1>Essential Profile</h1><span>Only settings that directly improve Recovery and training guidance are shown here.</span></header>
      {loading && <PageDataSkeleton variant="profile" label="Loading Your Profile" />}
      {!loading && profile && <>
        <section className="profile-settings-card">
          <header><IonIcon icon={heartOutline} /><div><p>Recovery</p><h2>Physiology</h2></div></header>
          <div className="profile-settings-grid">
            <label><span>Birth Date</span><input type="date" max={birthDateRange.maximum} min={birthDateRange.minimum} value={draft.birthDate} onChange={(event) => update('birthDate', event.target.value)} /><em>Used only for long-term Fitness Age context.</em></label>
            <label><span>VO₂ Max <SourceBadge label={profile?.fieldSources?.vo2max === 'health_connect' ? 'Samsung Health' : 'Profile'} /></span><div className="profile-input-unit"><input type="number" inputMode="decimal" min="10" max="100" step="0.1" value={draft.vo2max} onChange={(event) => update('vo2max', event.target.value)} placeholder="Example: 45.5" /><small>ml/kg/min</small></div><em>Fitness Age waits for this cardio signal.</em></label>
            <label><span>Max Heart Rate <SourceBadge label={maxHrSource} /></span><div className="profile-input-unit"><input type="number" inputMode="numeric" min="100" max="240" value={draft.maxHr} onChange={(event) => update('maxHr', event.target.value)} placeholder="Example: 190" /><small>bpm</small></div><em>Used to calculate Workout Strain.</em></label>
            <label><span>Body Weight <SourceBadge label={weightSource} /></span><div className="profile-input-unit"><input type="number" inputMode="decimal" min="30" max="300" step="0.1" value={draft.weightKg} onChange={(event) => update('weightKg', event.target.value)} placeholder="Example: 68.5" /><small>kg</small></div><em>{weightSource === 'Samsung Health' ? 'Synced from Samsung Health.' : 'Supports health and nutrition context.'}</em></label>
          </div>
          {observedHr && <div className="profile-observed"><div><span>Highest Observed In Workouts</span><strong>{observedHr.bpm} bpm</strong></div><button type="button" disabled={draft.maxHr === String(observedHr.bpm)} onClick={() => update('maxHr', String(observedHr.bpm))}>{draft.maxHr === String(observedHr.bpm) ? 'Selected' : 'Use Value'}</button></div>}
        </section>
        <section className="profile-settings-card">
          <header><IonIcon icon={heartOutline} /><div><p>Recovery</p><h2>My HR Zones</h2></div></header>
          {zoneBoundaries ? <details className="profile-hr-zone-disclosure">
            <summary>
              <div><strong>6 Personalized Zones</strong><span>HRR method · Resting {restingHrBaseline} bpm</span></div>
              <span className="profile-hr-zone-spectrum" aria-hidden="true">{zoneBoundaries.map((boundary) => <i key={boundary.zone} className={`zone-${boundary.zone}`} />)}</span>
            </summary>
            <div className="profile-hr-zone-detail">
              <ul className="profile-hr-zone-list">
                {zoneBoundaries.map((boundary) => (
                  <li key={boundary.zone} className={`profile-hr-zone profile-hr-zone-${boundary.zone}`}>
                    <span className="profile-hr-zone-index">Zone {boundary.zone}</span>
                    <span className="profile-hr-zone-label">{boundary.label}</span>
                    <span className="profile-hr-zone-range">{formatZoneRange(boundary)} <small>bpm</small></span>
                  </li>
                ))}
              </ul>
              <em className="profile-hr-zone-note">From Max Heart Rate ({maxHrNumber} bpm) and your recent Resting HR baseline ({restingHrBaseline} bpm), using the Heart Rate Reserve method.</em>
            </div>
          </details> : (
            <p className="profile-hr-zone-empty">
              {!draft.maxHr
                ? 'Add your Max Heart Rate above to see your personal HR Zones.'
                : 'RunMate needs a few recent nights of Sleep with Heart Rate data to calibrate your Resting HR before showing Zones.'}
            </p>
          )}
        </section>
        <section className="profile-settings-card">
          <header><IonIcon icon={barbellOutline} /><div><p>Training</p><h2>Weekly Preferences</h2></div></header>
          <div className="profile-settings-grid">
            <label><span>Training Days Per Week</span><input type="number" inputMode="numeric" min="1" max="7" value={draft.weeklyTrainingDays} onChange={(event) => update('weeklyTrainingDays', event.target.value)} placeholder="Example: 4" /><em>Default for new Race Goals.</em></label>
            <label><span>Preferred Long Run Day</span><select value={draft.preferredLongRunDay} onChange={(event) => update('preferredLongRunDay', event.target.value)}><option value="">Not Set</option>{DAYS.map((day) => <option value={day} key={day}>{day}</option>)}</select><em>Default for new Race Goals.</em></label>
            <label className="profile-settings-wide"><span>Preferred Training Time</span><select value={draft.preferredRunTime} onChange={(event) => update('preferredRunTime', event.target.value)}><option value="">Not Set</option><option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option><option value="flexible">Flexible</option></select><em>Helps RunMate place training guidance at a realistic time.</em></label>
          </div>
          <p className="profile-impact-note"><strong>Used By</strong><span>New Race Goals And Training Plans</span></p>
        </section>
        <section className="profile-settings-card">
          <header><IonIcon icon={moonOutline} /><div><p>Sleep</p><h2>Default Schedule</h2></div></header>
          <div className="profile-settings-grid">
            <label className="profile-settings-wide"><span>Default Wake Time <SourceBadge label="Profile Default" /></span><input type="time" value={draft.defaultWakeTime} onChange={(event) => update('defaultWakeTime', event.target.value)} /><em>Used by Sleep Window every day. Save For Tonight can still override it for one night.</em></label>
          </div>
          <p className="profile-impact-note"><strong>Used By</strong><span>Sleep Window And Bedtime Guidance</span></p>
        </section>
        <section className="profile-timezone-card"><IonIcon icon={globeOutline} /><div><span>Timezone</span><strong>Asia/Bangkok</strong><small>RunMate currently uses Bangkok dates for Sleep and Activity.</small></div></section>
        {error && <p className="profile-settings-error">{error}</p>}
        <button type="button" className={`profile-settings-save${saved ? ' saved' : ''}`} disabled={saving || !hasChanges} onClick={() => void save()}>{saving ? <IonSpinner name="crescent" /> : saved ? <IonIcon icon={checkmarkCircleOutline} /> : <IonIcon icon={scaleOutline} />}{saving ? 'Saving…' : saved ? 'Profile Saved' : hasChanges ? 'Save Profile' : 'No Changes'}</button>
      </>}
      {!loading && !profile && <PageState kind="error" title="Profile Is Unavailable" detail={error ?? 'Could Not Load Your Profile.'} actionLabel="Try Again" onAction={() => void load()} className="profile-settings-state profile-settings-failed" />}
    </main></IonContent>
    <IonAlert isOpen={discardOpen} onDidDismiss={() => setDiscardOpen(false)} header="Discard Unsaved Changes?" message="Your latest Profile changes have not been saved." buttons={[{ text: 'Keep Editing', role: 'cancel' }, { text: 'Discard', role: 'destructive', handler: () => { setSavedDraft(draft); window.setTimeout(() => history.push('/tabs/settings'), 0); } }]} />
  </IonPage>;
};

function SourceBadge({ label }: { label: string }) { return <small className="profile-source-badge">{label}</small>; }
function recentRestingHr(item: LocalHistoryItem): number | null {
  if (item.type !== 'sleep') return null;
  const data = item.data as Record<string, unknown> | null;
  const extracted = data?.extracted as Record<string, unknown> | undefined;
  const value = extracted?.restingHR;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatZoneRange(boundary: HeartRateZoneBoundary): string {
  if (boundary.lowerBpm == null) return `Below ${(boundary.upperBpm ?? 0) + 1}`;
  if (boundary.upperBpm == null) return `${boundary.lowerBpm}+`;
  return `${boundary.lowerBpm}–${boundary.upperBpm}`;
}

export default ProfileSettingsPage;

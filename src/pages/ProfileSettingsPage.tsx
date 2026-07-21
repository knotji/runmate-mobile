import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonAlert, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, barbellOutline, checkmarkCircleOutline, globeOutline, heartOutline, moonOutline, scaleOutline } from 'ionicons/icons';
import { defaultProfile, type UserProfile } from '@/types/profile';
import { loadProfileFromSupabase, saveProfileToSupabase } from '@/lib/profileStorage';
import { applyProfileSettings, DAYS, profileToSettingsDraft, validateProfileSettings, type ProfileSettingsDraft } from '@/lib/profileSettings';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { findHighestObservedHeartRate, type ObservedHeartRate } from '@/lib/observedHeartRate';
import { loadDefaultWakeTime, saveDefaultWakeTime } from '@/lib/sleepWindowStorage';
import { formatTimeInput, parseTimeInput } from '@/lib/sleepWindow';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import './ProfileSettingsPage.css';

const emptyDraft: ProfileSettingsDraft = { maxHr: '', weightKg: '', weeklyTrainingDays: '', preferredLongRunDay: '', preferredRunTime: '', defaultWakeTime: '' };

const ProfileSettingsPage: React.FC = () => {
  const history = useHistory();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [savedDraft, setSavedDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [observedHr, setObservedHr] = useState<ObservedHeartRate | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [result, historyResult, defaultWake] = await Promise.all([loadProfileFromSupabase(), loadHistoryItems(['workout', 'strength']), loadDefaultWakeTime()]);
    if (historyResult.ok) setObservedHr(findHighestObservedHeartRate(historyResult.items));
    if (!result.ok) setError(('message' in result && result.message) || 'Could Not Load Your Profile.');
    else {
      const next = result.profile ?? { ...defaultProfile, timezone: 'Asia/Bangkok' };
      setProfile(next);
      const nextDraft = { ...profileToSettingsDraft(next), defaultWakeTime: defaultWake == null ? '' : formatTimeInput(defaultWake) };
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const update = (key: keyof ProfileSettingsDraft, value: string) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false); setError(null); };
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
  const weightSource = draft.weightKg !== savedDraft.weightKg || profile?.fieldSources?.weightKg !== 'health_connect' ? 'Manual' : 'Samsung Health';

  return <IonPage>
    <IonHeader translucent className="profile-settings-header"><IonToolbar>
      <button type="button" className="profile-settings-back" aria-label="Back To More" onClick={() => history.push('/tabs/more')}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Profile & Settings</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="profile-settings-content"><main className="profile-settings-shell">
      <header className="profile-settings-intro"><p>Your RunMate</p><h1>Essential Profile</h1><span>Only settings that directly improve Recovery and training guidance are shown here.</span></header>
      {loading && <PageDataSkeleton variant="profile" label="Loading Your Profile" />}
      {!loading && profile && <>
        <section className="profile-settings-card">
          <header><IonIcon icon={heartOutline} /><div><p>Recovery</p><h2>Physiology</h2></div></header>
          <div className="profile-settings-grid">
            <label><span>Max Heart Rate <SourceBadge label={maxHrSource} /></span><div className="profile-input-unit"><input type="number" inputMode="numeric" min="100" max="240" value={draft.maxHr} onChange={(event) => update('maxHr', event.target.value)} placeholder="Example: 190" /><small>bpm</small></div><em>Used to calculate Workout Strain.</em></label>
            <label><span>Body Weight <SourceBadge label={weightSource} /></span><div className="profile-input-unit"><input type="number" inputMode="decimal" min="30" max="300" step="0.1" value={draft.weightKg} onChange={(event) => update('weightKg', event.target.value)} placeholder="Example: 68.5" /><small>kg</small></div><em>{weightSource === 'Samsung Health' ? 'Synced from Samsung Health.' : 'Supports health and nutrition context.'}</em></label>
          </div>
          {observedHr && <div className="profile-observed"><div><span>Highest Observed In Workouts</span><strong>{observedHr.bpm} bpm</strong></div><button type="button" disabled={draft.maxHr === String(observedHr.bpm)} onClick={() => update('maxHr', String(observedHr.bpm))}>{draft.maxHr === String(observedHr.bpm) ? 'Selected' : 'Use Value'}</button></div>}
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
    <IonAlert isOpen={discardOpen} onDidDismiss={() => setDiscardOpen(false)} header="Discard Unsaved Changes?" message="Your latest Profile changes have not been saved." buttons={[{ text: 'Keep Editing', role: 'cancel' }, { text: 'Discard', role: 'destructive', handler: () => { setSavedDraft(draft); window.setTimeout(() => history.push('/tabs/more'), 0); } }]} />
  </IonPage>;
};

function SourceBadge({ label }: { label: string }) { return <small className="profile-source-badge">{label}</small>; }

export default ProfileSettingsPage;

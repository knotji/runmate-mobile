import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IonButton, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { calendarClearOutline, closeOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase } from '@/lib/buildCoachContext';
import { todayBangkokDateKey } from '@/lib/date';
import { generateRacePlan } from '@/lib/racePlanGeneration';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { saveRaceGoalAndPlan } from '@/lib/raceStorage';
import type { RaceDistance, RaceGoal, RacePlan } from '@/types/race';
import './RaceGoalEditor.css';

type Props = {
  isOpen: boolean;
  goal: RaceGoal | null;
  onClose: () => void;
  onSaved: (goal: RaceGoal, plan: RacePlan) => void;
};

const distances: RaceDistance[] = ['5K', '10K', 'Half Marathon', 'Full Marathon', 'Custom'];
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function RaceGoalEditor({ isOpen, goal, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<RaceGoal>(() => initialGoal(goal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const longestRunEdited = useRef(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [longestRunFromProfile, setLongestRunFromProfile] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialGoal(goal));
      setError(null);
      longestRunEdited.current = false;
      setLongestRunFromProfile(false);
      setLoadingProfile(true);
      let active = true;
      void loadProfileFromSupabase().then((result) => {
        if (!active || !result.ok || !result.profile || longestRunEdited.current) return;
        if (result.profile.currentLongestRunKm != null) {
          setDraft((current) => ({ ...current, currentLongestRunKm: result.profile!.currentLongestRunKm }));
          setLongestRunFromProfile(true);
        }
      }).finally(() => { if (active) setLoadingProfile(false); });
      return () => { active = false; };
    }
  }, [goal, isOpen]);

  const update = <K extends keyof RaceGoal>(key: K, value: RaceGoal[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const validation = validateGoal(draft);
    if (validation) { setError(validation); return; }
    setSaving(true); setError(null);
    try {
      const context = await buildCoachContextFromSupabase();
      const plan = await generateRacePlan(draft, context);
      const saved = await saveRaceGoalAndPlan(draft, plan);
      if (!saved.ok) throw new Error(saved.error);
      onSaved(saved.goal, saved.plan);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could Not Save This Race Goal. Please Try Again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="race-editor-modal">
      <IonHeader className="race-editor-header"><IonToolbar><IonTitle>{goal ? 'Edit Race Goal' : 'Create Race Goal'}</IonTitle><IonButton slot="end" fill="clear" aria-label="Close Race Goal Editor" disabled={saving} onClick={onClose}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton></IonToolbar></IonHeader>
      <form className="race-editor-form" onSubmit={submit}>
        <header><p>RACE DETAILS</p><h2>{goal ? 'Update Your Goal' : 'Set Your Next Goal'}</h2><span>Saving will build a fresh training plan from your latest RunMate data.</span></header>

        <label><span>Race Name</span><input required maxLength={100} value={draft.raceName} placeholder="Example: Bangkok 10K" onChange={(event) => update('raceName', event.target.value)} /></label>
        <div className="race-editor-grid">
          <label className="race-editor-date"><span>Race Date</span><button type="button" onClick={() => dateRef.current?.showPicker?.()}><IonIcon icon={calendarClearOutline} /><strong>{formatDate(draft.raceDate)}</strong></button><input ref={dateRef} required type="date" min={todayBangkokDateKey()} value={draft.raceDate} onChange={(event) => update('raceDate', event.target.value)} /></label>
          <label><span>Distance</span><select value={draft.raceDistance} onChange={(event) => update('raceDistance', event.target.value as RaceDistance)}>{distances.map((distance) => <option key={distance}>{distance}</option>)}</select></label>
        </div>

        <div className="race-goal-toggle" role="group" aria-label="Goal Type">
          <button type="button" className={draft.goalType === 'finish' ? 'active' : ''} onClick={() => update('goalType', 'finish')}>Finish</button>
          <button type="button" className={draft.goalType === 'target_time' ? 'active' : ''} onClick={() => update('goalType', 'target_time')}>Target Time</button>
        </div>
        {draft.goalType === 'target_time' && <label><span>Target Time</span><input required inputMode="numeric" value={draft.targetTime ?? ''} placeholder={targetPlaceholder(draft.raceDistance)} onChange={(event) => update('targetTime', event.target.value)} /><small>Use MM:SS or HH:MM:SS.</small></label>}

        <div className="race-editor-divider" />
        <header className="race-editor-plan-heading"><p>PLAN SETUP</p><h2>Weekly Availability</h2></header>
        <div className="race-editor-grid">
          <label><span>Training Days</span><input required type="number" min="1" max="7" inputMode="numeric" value={draft.trainingDaysPerWeek ?? 4} onChange={(event) => update('trainingDaysPerWeek', Number(event.target.value))} /></label>
          <label><span>Long Run Day</span><select value={draft.preferredLongRunDay ?? 'Sunday'} onChange={(event) => update('preferredLongRunDay', event.target.value)}>{weekdays.map((day) => <option key={day}>{day}</option>)}</select></label>
        </div>
        <label><span>Current Longest Run (km) {loadingProfile ? <small>Loading Profile…</small> : longestRunFromProfile ? <small>From Profile</small> : null}</span><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.currentLongestRunKm ?? ''} onChange={(event) => { longestRunEdited.current = true; setLongestRunFromProfile(false); update('currentLongestRunKm', event.target.value ? Number(event.target.value) : undefined); }} /></label>

        {error && <div className="race-editor-error" role="alert">{error}</div>}
        <div className="race-editor-actions"><IonButton type="button" fill="outline" disabled={saving} onClick={onClose}>Cancel</IonButton><IonButton type="submit" disabled={saving}>{saving && <IonSpinner slot="start" name="crescent" />}{saving ? 'Building Plan…' : goal ? 'Save Goal And Refresh Plan' : 'Create Goal'}</IonButton></div>
      </form>
    </IonModal>
  );
}

function initialGoal(goal: RaceGoal | null): RaceGoal {
  return goal ? { ...goal, goalType: goal.targetTime ? 'target_time' : 'finish', preferredLongRunDay: normalizeDay(goal.preferredLongRunDay) } : { raceName: '', raceDate: '', raceDistance: '5K', goalType: 'finish', targetTime: '', currentLongestRunKm: undefined, trainingDaysPerWeek: 4, preferredLongRunDay: 'Sunday' };
}
function validateGoal(goal: RaceGoal): string | null {
  if (!goal.raceName.trim() || !goal.raceDate) return 'Complete The Race Name And Date.';
  if (goal.raceDate < todayBangkokDateKey()) return 'Race Date Must Be Today Or Later.';
  if ((goal.trainingDaysPerWeek ?? 0) < 1 || (goal.trainingDaysPerWeek ?? 0) > 7) return 'Training Days Must Be Between 1 And 7.';
  if (goal.goalType === 'target_time' && !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(goal.targetTime ?? '')) return 'Use MM:SS Or HH:MM:SS For Target Time.';
  return null;
}
function formatDate(value: string) { const [year, month, day] = value.split('-'); return year && month && day ? `${day}/${month}/${year}` : 'Select Date'; }
function targetPlaceholder(distance: RaceDistance) { return distance === '5K' ? '25:00' : distance === '10K' ? '55:00' : distance === 'Half Marathon' ? '02:00:00' : distance === 'Full Marathon' ? '04:30:00' : '01:00:00'; }
function normalizeDay(value?: string) { const map: Record<string,string> = { 'จันทร์':'Monday','วันจันทร์':'Monday','อังคาร':'Tuesday','วันอังคาร':'Tuesday','พุธ':'Wednesday','วันพุธ':'Wednesday','พฤหัสบดี':'Thursday','วันพฤหัสบดี':'Thursday','ศุกร์':'Friday','วันศุกร์':'Friday','เสาร์':'Saturday','วันเสาร์':'Saturday','อาทิตย์':'Sunday','วันอาทิตย์':'Sunday' }; return value ? map[value] ?? value : 'Sunday'; }

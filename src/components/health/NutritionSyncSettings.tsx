import { useEffect, useState } from 'react';
import { IonSpinner, IonToggle, useIonViewWillEnter } from '@ionic/react';
import {
  checkNutritionSyncAuthorization,
  loadLastNutritionSyncAttempt,
  loadNutritionSyncEnabled,
  requestNutritionSyncAuthorization,
  saveNutritionSyncEnabled,
  type NutritionSyncAttempt,
  type NutritionSyncAuthorization,
} from '@/lib/nutritionSync';

const ATTEMPT_LABEL: Record<NutritionSyncAttempt['outcome'], string> = {
  success: 'Synced',
  skipped_no_calories: 'Skipped — no nutrition values on that meal',
  skipped_not_authorized: 'Skipped — Health Connect write access is not granted',
  error: 'Failed',
};

/**
 * RunMate's only opt-in exception to an otherwise read-only Health Connect
 * integration: sharing each logged meal's calories and macros back out. Self-contained
 * (owns its own state) so HealthTestPage.tsx does not need another slice of state
 * for a single, independent preference.
 */
export function NutritionSyncSettings() {
  const [enabled, setEnabled] = useState(loadNutritionSyncEnabled);
  const [authorization, setAuthorization] = useState<NutritionSyncAuthorization | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<NutritionSyncAttempt | null>(() => loadLastNutritionSyncAttempt());

  useEffect(() => {
    if (!enabled) { setAuthorization(null); return; }
    void checkNutritionSyncAuthorization().then(setAuthorization);
  }, [enabled]);

  useIonViewWillEnter(() => setLastAttempt(loadLastNutritionSyncAttempt()));

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        const result = await requestNutritionSyncAuthorization();
        setAuthorization(result);
        const granted = result === 'granted';
        setEnabled(granted);
        saveNutritionSyncEnabled(granted);
      } else {
        setEnabled(false);
        saveNutritionSyncEnabled(false);
        setAuthorization(null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="health-nutrition-sync-card">
      <header>
        <div><span>Optional Sharing</span><h2>Share Logged Nutrition With Health Connect</h2></div>
        {busy ? <IonSpinner name="crescent" /> : (
          <IonToggle aria-label="Share Logged Nutrition With Health Connect" checked={enabled} disabled={busy} onIonChange={(event) => void toggle(event.detail.checked)} />
        )}
      </header>
      <p>When on, each saved meal&apos;s calories, protein, carbs, and fat are written to Health Connect as a Nutrition record, so other Health Connect apps (like Samsung Health) can see it. This is the only data RunMate writes to Health Connect; everything else stays read-only.</p>
      {authorization === 'denied' && <small role="status">Health Connect denied write access. Open Health Connect settings to allow it.</small>}
      {authorization === 'unavailable' && <small role="status">Health Connect is not available on this device.</small>}
      {lastAttempt && (
        <div className="health-nutrition-sync-last-attempt">
          <span>Last Sync Attempt</span>
          <strong>{ATTEMPT_LABEL[lastAttempt.outcome]}</strong>
          <small>{new Date(lastAttempt.at).toLocaleString()}{lastAttempt.detail ? ` · ${lastAttempt.detail}` : ''}</small>
        </div>
      )}
    </section>
  );
}

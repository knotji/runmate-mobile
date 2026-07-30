import { useEffect, useState, type CSSProperties } from 'react';
import { IonCard, IonCardContent, IonIcon } from '@ionic/react';
import { chevronForwardOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import { formatClockMinutes, parseClockMinutes, sleepCyclePlanForWake, sleepWindowForWake, type SleepCycleCount } from '@/lib/sleepWindow';

export function RecoveryLoadingDials({ stage }: { stage: 'syncing' | 'calculating' }) {
  const status = stage === 'syncing'
    ? 'Syncing today\'s Health Connect data'
    : 'Calculating your Recovery metrics';
  return (
    <IonCard className="recovery-dials recovery-dials-loading" role="status" aria-live="polite" aria-label={status}>
      <IonCardContent>
        <div className="dial-grid" aria-hidden="true">
          <MetricDial label="Recovery" value={null} max={100} tone="recovery" loading />
          <MetricDial label="Strain" value={null} max={21} tone="strain" loading />
          <MetricDial label="Sleep" value={null} max={100} tone="sleep" loading />
        </div>
      </IonCardContent>
    </IonCard>
  );
}

export function RecoverySecondaryLoading() {
  return (
    <section className="recovery-secondary-loading" role="status" aria-label="Loading today's guidance">
      <div><i /><span /></div>
      <div><i /><span /></div>
    </section>
  );
}

export function RecoverySecondaryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <section className="recovery-secondary-error" role="status"><span>{message}</span><button type="button" onClick={onRetry}>Try Again</button></section>;
}

export function RecoveryDials({
  recovery,
  onRecoveryClick,
  onSleepClick,
  freshness,
  onFreshnessClick,
}: {
  recovery: RunMateRecoverySystem;
  onRecoveryClick: () => void;
  onSleepClick: () => void;
  freshness?: { status: 'fresh' | 'refreshing' | 'stale'; detail: string };
  onFreshnessClick?: () => void;
}) {
  const recoveryAvailable = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating';
  const waitingMessage = recoveryAvailable
    ? null
    : recovery.dataFreshness.status === 'today'
      ? 'Waiting For Recovery Signals'
      : 'Waiting For Last Night\'s Sleep';
  return (
    <IonCard className="recovery-dials">
      <IonCardContent>
        <div className="recovery-hero-layout">
          <div className="recovery-score-stage">
            <MetricDial label="Recovery" value={recoveryAvailable ? Math.round(recovery.overallScore) : null} max={100} tone="recovery" onClick={onRecoveryClick} />
            <div className="recovery-hero-copy">
              <div className="recovery-hero-meta">
                <span>Daily readiness</span>
                {freshness && freshness.status === 'stale' && onFreshnessClick
                  ? <button type="button" className="recovery-inline-freshness recovery-inline-freshness-stale" onClick={onFreshnessClick} aria-label={`${freshness.detail}. Refresh Recovery data`}><i />{freshness.detail}</button>
                  : freshness && <small className={`recovery-inline-freshness recovery-inline-freshness-${freshness.status}`}><i />{freshness.detail}</small>}
              </div>
              <strong>{recoveryAvailable ? recovery.overallLabel : 'Not ready yet'}</strong>
              <p>{recoveryAvailable ? recovery.overallDisplayStatus.note ?? 'Your latest signals are ready for today.' : waitingMessage}</p>
            </div>
          </div>
          <div className="recovery-support-metrics">
            <MetricDial label="Sleep" value={recovery.dataFreshness.status === 'today' ? recovery.sleepPerformance.score : null} max={100} tone="sleep" onClick={onSleepClick} />
            <MetricDial label="Strain" value={recovery.strain.score} max={21} tone="strain" />
          </div>
        </div>
        {waitingMessage && (
          <div className="recovery-waiting-message" role="status">
            <span>{waitingMessage}</span>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
}

function MetricDial({ label, value, max, tone, onClick, loading = false }: { label: string; value: number | null; max: number; tone: 'recovery' | 'strain' | 'sleep'; onClick?: () => void; loading?: boolean }) {
  const percentage = value == null ? 0 : Math.max(0, Math.min(100, value / max * 100));
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const displayValue = value == null ? '—' : Math.round(value).toString();

  useEffect(() => {
    if (loading || value == null) {
      setAnimatedPercentage(0);
      return;
    }
    const frame = window.requestAnimationFrame(() => setAnimatedPercentage(percentage));
    return () => window.cancelAnimationFrame(frame);
  }, [loading, percentage, value]);

  const ringStyle = loading
    ? undefined
    : { '--dial-progress': `${animatedPercentage}%` } as CSSProperties;
  const content = (
    <>
      <span className="dial-label">{label}</span>
      <div
        className={`dial-ring ${loading ? 'dial-ring-loading' : 'dial-ring-ready'}`}
        style={ringStyle}
        role="img"
        aria-label={loading ? `${label} is being calculated` : `${label} ${displayValue} out of ${max}`}
      >
        <div className="dial-center">
          {loading
            ? <><strong className="dial-loading-value">—</strong><small>/{max}</small></>
            : <span className="dial-loaded-value"><strong>{displayValue}</strong><small>/{max}</small></span>}
        </div>
      </div>
    </>
  );
  return onClick
    ? <button type="button" className={`metric-dial metric-dial-button dial-${tone}`} onClick={onClick} aria-label={`Open ${label} details`}>{content}</button>
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

export function RecoveryPlan({ recovery, wakeOverrideMinutes, sleepCycleOverride, onOpen }: { recovery: RunMateRecoverySystem; wakeOverrideMinutes: number | null; sleepCycleOverride: SleepCycleCount | null; onOpen: () => void }) {
  const sleep = recovery.sleepPerformance;
  const sleepNeedHours = Math.floor(sleep.sleepNeedMinutes / 60);
  const sleepNeedMinutes = sleep.sleepNeedMinutes % 60;
  const profileWakeMinutes = parseClockMinutes(sleep.targetWakeTime);
  const wakeMinutes = wakeOverrideMinutes ?? profileWakeMinutes;
  const window = wakeMinutes == null ? null : sleepWindowForWake(wakeMinutes, sleep.sleepNeedMinutes);
  const cyclePlan = wakeMinutes == null || sleepCycleOverride == null ? null : sleepCyclePlanForWake(wakeMinutes, sleepCycleOverride, sleep.sleepNeedMinutes);
  const inBedMinutes = cyclePlan?.inBedMinutes ?? window?.idealInBedMinutes ?? null;
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
          <h3>{inBedMinutes != null ? `In Bed By ${formatClockMinutes(inBedMinutes)}` : `Sleep ${sleepNeedHours}h ${sleepNeedMinutes}m`}</h3>
          {window ? (
            <div className="sleep-schedule-details">
              <p className="sleep-times"><span>{cyclePlan ? 'Cycle Plan' : 'Window'}</span><strong>{cyclePlan ? `${cyclePlan.cycleCount} cycles` : `${formatClockMinutes(window.windowStartMinutes)}–${formatClockMinutes(window.windowEndMinutes)}`}</strong><i aria-hidden="true" /><span>Wake</span><strong>{formatClockMinutes(window.wakeMinutes)}</strong></p>
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

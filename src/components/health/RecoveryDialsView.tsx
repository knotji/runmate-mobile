import { useEffect, useState, type CSSProperties } from 'react';
import { IonCard, IonCardContent, IonIcon } from '@ionic/react';
import { chevronForwardOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import type { EnergyReserve } from '@/lib/energyReserve';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import type { RecoveryWhy } from '@/lib/recoveryWhy';
import { formatMinutes } from '@/lib/sleepDetailFormatting';
import type { TodayBriefItem, TodayReadiness } from '@/lib/todayBrief';
import type { TodayContinuity } from '@/lib/todayContinuity';

export function RecoveryLoadingDials({ stage }: { stage: 'syncing' | 'calculating' }) {
  const status = stage === 'syncing'
    ? 'Syncing today\'s Health Connect data'
    : 'Calculating your Recovery metrics';
  return (
    <IonCard className="recovery-dials recovery-dials-loading" role="status" aria-live="polite" aria-label={status}>
      <IonCardContent>
        <div className="dial-grid dial-grid-4" aria-hidden="true">
          <MetricDial label="Recovery" value={null} max={100} tone="recovery" loading />
          <MetricDial label="Sleep" value={null} max={100} tone="sleep" loading />
          <MetricDial label="Strain" value={null} max={21} tone="strain" loading />
          <MetricDial label="Energy" value={null} max={100} tone="energy" loading />
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

/**
 * Level 1 — the body-status hero. Reads TodayReadiness (todayBrief.ts's
 * buildTodayReadiness), which needs only RunMateRecoverySystem, so this can
 * render the moment Recovery is ready - before the rest of CoachContext
 * (needed by the Why/Continuity/Action cards below) has finished loading.
 */
export function TodayHero({
  readiness,
  freshness,
  onFreshnessClick,
}: {
  readiness: TodayReadiness;
  freshness?: { status: 'fresh' | 'refreshing' | 'stale'; detail: string };
  onFreshnessClick?: () => void;
}) {
  return (
    <section className={`today-hero today-hero-${readiness.status}`} aria-label="Body Status Today">
      <span className="today-hero-eyebrow">Body Status Today</span>
      <h1 className="today-hero-title">{readiness.title}</h1>
      <p className="today-hero-summary">{readiness.summary}</p>
      {freshness && (freshness.status === 'stale' && onFreshnessClick
        ? <button type="button" className="today-hero-freshness is-stale" onClick={onFreshnessClick} aria-label={`${freshness.detail}. Refresh Recovery data`}>{freshness.detail}</button>
        : <span className={`today-hero-freshness is-${freshness.status}`}>{freshness.detail}</span>)}
    </section>
  );
}

/** Level 1b — the scannable evidence row: Recovery / Sleep / Strain / Energy, one glance each. */
export function TodayRingsRow({
  recovery,
  energy,
  onRecoveryClick,
  onSleepClick,
  onStrainClick,
  onEnergyClick,
}: {
  recovery: RunMateRecoverySystem;
  energy: EnergyReserve | null;
  onRecoveryClick: () => void;
  onSleepClick: () => void;
  onStrainClick: () => void;
  onEnergyClick: () => void;
}) {
  const recoveryAvailable = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating';
  const waitingMessage = recoveryAvailable
    ? null
    : recovery.dataFreshness.status === 'today'
      ? 'Waiting For Recovery Signals'
      : 'Waiting For Last Night\'s Sleep';
  const sleepScore = recovery.dataFreshness.status === 'today' ? recovery.sleepPerformance.score : null;
  // Sleep shows actual last-night duration as its primary value, never the
  // score - the ring's fill percentage still comes from sleepScore/100
  // (below) so it stays visually consistent with the other three dials.
  // Only ever set when the real minutes are known; otherwise MetricDial
  // falls back to showing the score itself rather than a fabricated "0h 00m".
  const sleepDurationText = recovery.dataFreshness.status === 'today' && recovery.sleepPerformance.actualSleepMinutes != null
    ? formatMinutes(recovery.sleepPerformance.actualSleepMinutes)
    : undefined;
  return (
    <IonCard className="today-rings-card">
      <IonCardContent>
        <div className="today-rings-row" aria-label="Today's key signals">
          <MetricDial label="Recovery" value={recoveryAvailable ? Math.round(recovery.overallScore) : null} max={100} tone="recovery" onClick={onRecoveryClick} />
          <MetricDial label="Sleep" value={sleepScore} max={100} tone="sleep" onClick={onSleepClick} displayText={sleepDurationText} />
          <MetricDial label="Strain" value={recovery.strain.score} max={21} tone="strain" onClick={onStrainClick} />
          <MetricDial label="Energy" value={energy?.available ? energy.score : null} max={100} tone="energy" onClick={onEnergyClick} />
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

/**
 * Level 2 — the WHY card. Main reason (todayBrief.ts's limiter) always shows;
 * the ranked "Recovery Why" factor lines (recoveryWhy.ts) only appear when
 * status is 'ready' - never a placeholder pretending to explain.
 */
export function TodayWhyCard({ limiter, why }: { limiter: TodayBriefItem; why?: RecoveryWhy }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={`today-why-card${open ? ' open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      <div className="today-why-head">
        <span className="today-why-eyebrow">{limiter.eyebrow}</span>
        <IonIcon icon={chevronForwardOutline} className="today-why-chevron" aria-hidden="true" />
      </div>
      <p className="today-why-title">{limiter.title}</p>
      <div className="today-why-detail-wrap">
        <div className="today-why-detail-inner">
          <p className="today-why-detail">{limiter.summary}</p>
          {why && why.status === 'ready' && (
            <ul className="recovery-why-list" aria-label="What's shaping today's Recovery">
              {why.factors.map((factor) => (
                <li key={factor.key} className={`recovery-why-item is-${factor.tone}`}>
                  <span className="recovery-why-mark" aria-hidden="true">{factor.tone === 'up' ? '↑' : factor.tone === 'down' ? '↓' : '–'}</span>
                  <span>{factor.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Level 3 — the one thing to do. Reads todayBrief.ts's action item verbatim;
 * never re-derives it. Content-only by design - Ask Coach lives in a
 * separate floating FAB (RecoveryPage.tsx) so this card never competes with
 * it for attention.
 */
export function TodayActionCard({ action }: { action: TodayBriefItem }) {
  return (
    <section className="today-action-card" aria-label="One Useful Move">
      <span className="today-action-eyebrow">{action.eyebrow || 'One Useful Move'}</span>
      <p className="today-action-title">{action.title}</p>
      <p className="today-action-detail">{action.summary}</p>
    </section>
  );
}

function MetricDial({ label, value, max, tone, onClick, loading = false, displayText }: {
  label: string;
  value: number | null;
  max: number;
  tone: 'recovery' | 'strain' | 'sleep' | 'energy';
  onClick?: () => void;
  loading?: boolean;
  /**
   * Overrides the center text (e.g. "6h 40m") while the ring's fill
   * percentage still comes from value/max - used only by Sleep on the Today
   * rings row, which fills by Sleep score but must display actual sleep
   * duration, never a score, as the primary value. Only ever passed when the
   * real duration is known; the '/max' unit is hidden since a duration isn't
   * "out of" max.
   */
  displayText?: string;
}) {
  const percentage = value == null ? 0 : Math.max(0, Math.min(100, value / max * 100));
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const displayValue = displayText ?? (value == null ? '—' : Math.round(value).toString());
  const showUnit = displayText == null;

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
        aria-label={loading ? `${label} is being calculated` : showUnit ? `${label} ${displayValue} out of ${max}` : `${label} ${displayValue}`}
      >
        <div className="dial-center">
          {loading
            ? <><strong className="dial-loading-value">—</strong><small>/{max}</small></>
            : <span className="dial-loaded-value"><strong>{displayValue}</strong>{showUnit && <small>/{max}</small>}</span>}
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

/**
 * "Yesterday → Today" — reuses the same .loop-card language as the Sleep
 * Plan/Tomorrow card below it (no new card style). Renders nothing at all
 * for continuity.status === 'none' - the caller is expected to skip
 * mounting this component entirely in that case, but it's also a no-op
 * here as a second guard against ever rendering a forced "all connected!"
 * placeholder.
 */
export function TodayContinuityCard({ continuity }: { continuity: TodayContinuity }) {
  if (continuity.status === 'none') return null;
  const tone = continuity.status === 'ready' ? continuity.tone : 'gap';
  return (
    <section className="loop-section" aria-label="Yesterday to today">
      <div className={`loop-card continuity-card is-${tone}`}>
        <IonIcon icon={tone === 'up' ? sunnyOutline : moonOutline} aria-hidden="true" />
        <div>
          <span>{tone === 'up' ? 'Yesterday' : tone === 'down' ? 'Yesterday' : 'Data Gap'}</span>
          <p>{continuity.message}</p>
        </div>
      </div>
    </section>
  );
}

import { useMemo } from 'react';
import { IonIcon } from '@ionic/react';
import { sparklesOutline } from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import { buildAdaptiveTrainingRecommendation } from '@/lib/adaptiveTrainingPlan';
import { buildRecoveryExplainability } from '@/lib/recoveryExplainability';
import { buildDailyRecommendation } from '@/lib/dailyRecommendation';
import { buildSupportCards } from '@/lib/recoverySupport';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import { buildTodayBrief } from '@/lib/todayBrief';
import './TodayTrainingPlanCard.css';

export function TodayTrainingPlanCard({ context, onAskCoach }: { context: CoachContext; onAskCoach?: () => void }) {
  const planned = getTodayPlannedWorkout(context);
  const status = planned ? getTodayTrainingPlanStatus(context, planned) : null;
  const recommendation = useMemo(() => buildAdaptiveTrainingRecommendation(context, planned), [context, planned]);
  const explainability = useMemo(() => buildRecoveryExplainability(context.recoverySystem), [context.recoverySystem]);
  const dailyRecommendation = useMemo(
    () => buildDailyRecommendation(context, explainability, planned),
    [context, explainability, planned],
  );
  const brief = useMemo(
    () => buildTodayBrief(context, {
      planned,
      recommendation,
      planStatus: status,
      dailyAction: dailyRecommendation.status === 'ready' ? dailyRecommendation.action : null,
    }),
    [context, planned, recommendation, status, dailyRecommendation],
  );
  const supportCards = buildSupportCards(context);
  const explainabilityItems = explainability.status === 'ready'
    ? [
      ...explainability.helping.slice(0, 2).map((factor) => ({ eyebrow: 'Helping Today', title: factor.label, summary: factor.detail, className: 'plan-support-helping' })),
      ...explainability.hurting.slice(0, 2).map((factor) => ({ eyebrow: 'Hurting Today', title: factor.label, summary: factor.detail, className: 'plan-support-hurting' })),
    ]
    : [];
  const plannedWorkoutItem = dailyRecommendation.status === 'ready' && dailyRecommendation.plannedWorkoutNote
    ? [{ eyebrow: "Today's Plan", title: dailyRecommendation.plannedWorkoutNote, summary: 'From your active Race Plan.', className: 'plan-support-plan' }]
    : [];
  const supportItems = [
    ...plannedWorkoutItem,
    ...explainabilityItems,
    ...brief.evidence.map((item) => ({ ...item, className: 'plan-support-data' })),
    ...supportCards.map((card) => ({ ...card, eyebrow: card.category, className: `plan-support-${card.category}` })),
  ];
  const keySignals = supportItems.slice(0, 3);
  const remainingSignals = supportItems.slice(3);
  const supportCount = supportItems.length;

  return (
    <section
      className={`plan-card ${status === 'completed' ? 'plan-card-completed' : status === 'logged_different' ? 'plan-card-different' : ''}${recommendation && recommendation.action !== 'keep' ? ' plan-card-adapted' : ''}`}
      aria-label="Today's Brief"
    >
      <div className="plan-card-main">
        <div className="plan-card-eyebrow">
          <span>Today's Brief</span>
          {dailyRecommendation.status === 'ready' && (
            <em className={`today-focus-badge today-focus-${dailyRecommendation.action}`} aria-label="Today's Focus">
              {dailyRecommendation.label}
            </em>
          )}
        </div>
        <div className="today-brief-context">
          <div aria-label="Body Status">
            <small>Body Status</small>
            <strong>{brief.readiness.title}</strong>
          </div>
          <div aria-label="Main Reason">
            <small>Main Reason</small>
            <strong>{brief.limiter.title}</strong>
          </div>
        </div>
        <div className={`today-brief-focus${onAskCoach ? ' has-coach-action' : ''}`} aria-label="One Useful Action">
          <div className="today-brief-focus-copy">
            <small>{brief.action.eyebrow}</small>
            <strong>{brief.action.title}</strong>
            <p>{brief.action.summary}</p>
          </div>
          {onAskCoach && <button type="button" className="today-brief-coach" aria-label="Ask Coach About Today" onClick={onAskCoach}>
            <IonIcon icon={sparklesOutline} aria-hidden="true" />
            <span>Coach</span>
          </button>}
        </div>
      </div>
      {supportCount > 0 && (
        <details className="plan-support-details">
          <summary>
            <span>Support And Data</span>
            <small>{keySignals.length} key {keySignals.length === 1 ? 'signal' : 'signals'}</small>
          </summary>
          <div className="plan-support-list">
            {keySignals.map((item) => (
              <div className={item.className} key={`${item.eyebrow}-${item.title}`}>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </div>
            ))}
            {remainingSignals.length > 0 && (
              <details className="plan-support-more">
                <summary>View {remainingSignals.length} more {remainingSignals.length === 1 ? 'signal' : 'signals'}</summary>
                <div>
                  {remainingSignals.map((item) => (
                    <div className={item.className} key={`${item.eyebrow}-${item.title}`}>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

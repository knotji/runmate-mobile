import { useMemo } from 'react';
import type { CoachContext } from '@/lib/buildCoachContext';
import { buildAdaptiveTrainingRecommendation } from '@/lib/adaptiveTrainingPlan';
import { buildSupportCards } from '@/lib/recoverySupport';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import { buildTodayBrief } from '@/lib/todayBrief';
import './TodayTrainingPlanCard.css';

export function TodayTrainingPlanCard({ context }: { context: CoachContext }) {
  const planned = getTodayPlannedWorkout(context);
  const status = planned ? getTodayTrainingPlanStatus(context, planned) : null;
  const recommendation = useMemo(() => buildAdaptiveTrainingRecommendation(context, planned), [context, planned]);
  const brief = useMemo(
    () => buildTodayBrief(context, { planned, recommendation, planStatus: status }),
    [context, planned, recommendation, status],
  );
  const supportCards = buildSupportCards(context);
  const supportItems = [
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
          {recommendation && status === 'pending' && (
            <em className={`adaptive-action adaptive-action-${recommendation.action}`}>Adaptive · {recommendation.label}</em>
          )}
        </div>
        <div className="today-brief-grid">
          {[brief.readiness, brief.limiter, brief.action].map((item, index) => (
            <article
              className={index === 1 ? 'today-brief-limiter' : index === 2 ? 'today-brief-action' : ''}
              key={item.eyebrow}
            >
              <small>{item.eyebrow}</small>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
            </article>
          ))}
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
                <summary>View all {supportCount} signals</summary>
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

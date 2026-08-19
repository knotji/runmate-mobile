import { useState } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { chevronForward, sparklesOutline } from 'ionicons/icons';
import { TODAY_SCENARIOS } from './mockToday';
import { MetricRing } from './MetricRing';
import { LabNav } from './LabNav';
import './tokens.css';
import './shared.css';
import './TodayNextPage.css';

const TodayNextPage: React.FC = () => {
  const [scenarioId, setScenarioId] = useState(TODAY_SCENARIOS[0].id);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const scenario = TODAY_SCENARIOS.find((s) => s.id === scenarioId) ?? TODAY_SCENARIOS[0];

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="wmn-content">
        <div className="wm-next wmn-today">
          <div className="wmn-lab-banner">
            <span>WholeMate Next — Today prototype</span>
            <span className="wmn-lab-banner-tag">not shipped</span>
          </div>

          <div className="wmn-scenario-picker" role="tablist" aria-label="Preview body status">
            {TODAY_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === scenarioId}
                className={`wmn-scenario-tab${s.id === scenarioId ? ' active' : ''}`}
                onClick={() => { setScenarioId(s.id); setReasonOpen(false); }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Level 1 — body status */}
          <section key={scenario.id} className={`wmn-hero wmn-hero-${scenario.status}`}>
            <span className="wmn-hero-eyebrow">Body Status Today</span>
            <h1 className="wmn-hero-title">{scenario.statusTitle}</h1>
            <p className="wmn-hero-summary">{scenario.statusSummary}</p>
            <span className="wmn-hero-freshness">{scenario.freshness}</span>
          </section>

          {/* Scannable evidence row */}
          <section className="wmn-rings-row" aria-label="Today's key signals">
            {scenario.metrics.map((metric, index) => (
              <MetricRing key={metric.key} metric={metric} delayMs={index * 70} onOpen={() => setReasonOpen(true)} />
            ))}
          </section>

          {/* Level 2 — main reason */}
          <button
            type="button"
            className={`wmn-card wmn-reason-card${reasonOpen ? ' open' : ''}`}
            onClick={() => setReasonOpen((v) => !v)}
            aria-expanded={reasonOpen}
          >
            <div className="wmn-reason-head">
              <span className="wmn-eyebrow">{scenario.mainReason.eyebrow}</span>
              <IonIcon icon={chevronForward} className="wmn-reason-chevron" />
            </div>
            <p className="wmn-reason-title">{scenario.mainReason.title}</p>
            <div className="wmn-reason-detail-wrap">
              <p className="wmn-reason-detail">{scenario.mainReason.detail}</p>
            </div>
          </button>

          {/* Level 3 — the one thing to do */}
          <section className="wmn-card wmn-action-card">
            <span className="wmn-eyebrow">One Useful Move</span>
            <p className="wmn-action-title">{scenario.oneThing.title}</p>
            <p className="wmn-action-detail">{scenario.oneThing.detail}</p>
            <button type="button" className="wmn-action-button">
              {scenario.oneThing.actionLabel}
              <IonIcon icon={chevronForward} />
            </button>
          </section>

          <div className="wmn-bottom-spacer" />
        </div>

        {/* Coach — contextual sheet, not a dashboard */}
        <div className="wm-next">
          <button type="button" className="wmn-coach-fab" onClick={() => setCoachOpen(true)} aria-label="Ask Coach about today">
            <IonIcon icon={sparklesOutline} />
          </button>
          <div className={`wmn-coach-sheet-scrim${coachOpen ? ' visible' : ''}`} onClick={() => setCoachOpen(false)} />
          <div className={`wmn-coach-sheet${coachOpen ? ' open' : ''}`} role="dialog" aria-label="Ask Coach">
            <div className="wmn-coach-sheet-handle" />
            <span className="wmn-eyebrow">Coach · About Today</span>
            <p className="wmn-coach-sheet-title">Want the longer explanation?</p>
            <p className="wmn-coach-sheet-body">
              Ask a follow-up about “{scenario.mainReason.title}” — Coach opens right here, in context, instead of a
              separate tab.
            </p>
            <button type="button" className="wmn-action-button" onClick={() => setCoachOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </IonContent>
      <LabNav active="today" />
    </IonPage>
  );
};

export default TodayNextPage;

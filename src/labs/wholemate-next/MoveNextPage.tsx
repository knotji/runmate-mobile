import { useCallback, useState } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { chevronForward, personCircleOutline } from 'ionicons/icons';
import { MOVE_TODAY_PLAN, MOVE_TIMELINE, type MoveTimelineItem, type MoveTodayPlan } from './mockMove';
import { loadRealMoveData, type RealMoveResult } from './realMove';
import { LabNav } from './LabNav';
import './tokens.css';
import './shared.css';
import './MoveNextPage.css';

const STATE_PANEL_COPY: Record<Exclude<RealMoveResult['status'], 'ready'>, { title: string; detail: string }> = {
  unauthenticated: { title: 'Log In To Preview Real Data', detail: 'This device isn’t signed in, so there’s no account context to load. Mock data still works without one.' },
  error: { title: 'Couldn’t Load Your Data', detail: '' },
};

const MoveNextPage: React.FC = () => {
  const [dataMode, setDataMode] = useState<'mock' | 'real'>('mock');
  const [realLoading, setRealLoading] = useState(false);
  const [realResult, setRealResult] = useState<RealMoveResult | null>(null);

  const switchToRealData = useCallback(async () => {
    setDataMode('real');
    setRealLoading(true);
    const result = await loadRealMoveData();
    setRealResult(result);
    setRealLoading(false);
  }, []);

  const switchToMockData = () => setDataMode('mock');

  const plan: MoveTodayPlan = dataMode === 'real' && realResult?.status === 'ready' ? realResult.plan : MOVE_TODAY_PLAN;
  const timeline: MoveTimelineItem[] = dataMode === 'real' && realResult?.status === 'ready' ? realResult.timeline : MOVE_TIMELINE;
  // Today's Plan is meant to stay the visual anchor of this page — capping
  // the preview here (not in realMove.ts, which keeps fetching/deduping its
  // full row limit) keeps the timeline from reading as an activity-history
  // screen without touching real-data behavior.
  const VISIBLE_TIMELINE_LIMIT = 5;
  const visibleTimeline = timeline.slice(0, VISIBLE_TIMELINE_LIMIT);
  const hasMoreTimeline = timeline.length > visibleTimeline.length;
  const statePanel = dataMode === 'real' && realResult && realResult.status !== 'ready' ? STATE_PANEL_COPY[realResult.status] : null;
  const statePanelDetail = statePanel && realResult && 'message' in realResult ? realResult.message : statePanel?.detail;

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="wmn-content">
        <div className="wm-next wmn-move">
          <div className="wmn-lab-banner">
            <span>WholeMate Next — Move prototype</span>
            <span className="wmn-lab-banner-tag">not shipped</span>
          </div>

          <header className="wmn-page-header">
            <span className="wmn-hero-eyebrow wmn-page-eyebrow-accent">Moving & Training</span>
            <h1 className="wmn-page-title">Move</h1>
          </header>

          <div className="wmn-data-mode-row">
            <button
              type="button"
              className={`wmn-real-data-toggle${dataMode === 'real' ? ' active' : ''}`}
              onClick={() => { if (dataMode === 'real') { switchToMockData(); } else { void switchToRealData(); } }}
              aria-pressed={dataMode === 'real'}
            >
              <IonIcon icon={personCircleOutline} />
              My Real Data
            </button>
          </div>

          {realLoading && (
            <div className="wmn-card wmn-state-panel">
              <span className="wmn-eyebrow">Loading</span>
              <p className="wmn-state-panel-title">Reading your planned training and recent activity…</p>
            </div>
          )}

          {!realLoading && statePanel && (
            <div className="wmn-card wmn-state-panel">
              <span className="wmn-eyebrow">My Real Data</span>
              <p className="wmn-state-panel-title">{statePanel.title}</p>
              {statePanelDetail && <p className="wmn-state-panel-detail">{statePanelDetail}</p>}
              <button type="button" className="wmn-action-button" onClick={switchToMockData}>
                Back To Mock Data
              </button>
            </div>
          )}

          {!realLoading && !statePanel && (
            <>
              {/* Today's plan — the one thing worth knowing before browsing history */}
              <section className="wmn-card wmn-action-card">
                <span className="wmn-eyebrow">Today’s Plan</span>
                <p className="wmn-action-title">{plan.title}</p>
                <p className="wmn-action-detail">{plan.detail}</p>
                <button type="button" className="wmn-action-button">
                  {plan.actionLabel}
                  <IonIcon icon={chevronForward} />
                </button>
              </section>

              {/* Movement timeline — what actually happened, most recent first.
                  Capped so it previews recent history rather than competing
                  with Today's Plan as the page's anchor. */}
              <section className="wmn-card wmn-timeline-card">
                <span className="wmn-eyebrow">Movement Timeline</span>
                {visibleTimeline.length === 0 ? (
                  <p className="wmn-timeline-empty">Nothing logged yet — recorded workouts and strength sessions will show up here.</p>
                ) : (
                  <ul className="wmn-timeline-list">
                    {visibleTimeline.map((item) => (
                      <li key={item.id} className="wmn-timeline-row">
                        <span className="wmn-timeline-icon">
                          <IonIcon icon={item.icon} />
                        </span>
                        <div className="wmn-timeline-body">
                          <div className="wmn-timeline-head">
                            <p className="wmn-timeline-title">{item.title}</p>
                            <span className="wmn-timeline-date">{item.dateLabel}</span>
                          </div>
                          <p className="wmn-timeline-detail">{item.detail}</p>
                          <span className="wmn-timeline-source">{item.source}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {hasMoreTimeline && (
                  // Plain text, not a link — there's no "all activity" screen
                  // in this prototype yet, so this stays honest about being
                  // a preview instead of pointing at a destination that
                  // doesn't exist.
                  <p className="wmn-timeline-more-note">Showing your {visibleTimeline.length} most recent.</p>
                )}
              </section>
            </>
          )}
        </div>
      </IonContent>
      <LabNav active="move" />
    </IonPage>
  );
};

export default MoveNextPage;

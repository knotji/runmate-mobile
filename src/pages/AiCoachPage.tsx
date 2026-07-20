import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline, helpCircleOutline, sparklesOutline, warningOutline } from 'ionicons/icons';
import { PageState } from '@/components/PageState';
import { AI_COACH_TOPICS, askAiCoach, type AiCoachAnswer, type AiCoachTopic } from '@/lib/aiCoach';
import type { CoachContext } from '@/lib/buildCoachContext';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import './AiCoachPage.css';

const AiCoachPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [asking, setAsking] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<AiCoachTopic | null>(null);
  const [answer, setAnswer] = useState<AiCoachAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    setLoadingContext(true); setError(null);
    try { setContext(await buildCoachContextFromSupabase()); }
    catch (failure) { setError(message(failure, 'Your RunMate data could not be loaded.')); }
    finally { setLoadingContext(false); }
  }, []);

  useEffect(() => { void loadContext(); }, [loadContext]);

  const ask = async (topic: AiCoachTopic) => {
    if (!context || asking) return;
    setSelectedTopic(topic); setAnswer(null); setError(null); setAsking(true);
    try { setAnswer(await askAiCoach(topic, context)); }
    catch (failure) { setError(message(failure, 'AI Coach is temporarily unavailable.')); }
    finally { setAsking(false); }
  };

  const activeTopic = AI_COACH_TOPICS.find((topic) => topic.id === selectedTopic);

  return <IonPage>
    <IonHeader translucent className="ai-coach-header"><IonToolbar>
      <button type="button" className="ai-coach-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>AI Coach</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="ai-coach-content">
      <main className="ai-coach-shell">
        <header className="ai-coach-heading">
          <div className="ai-coach-mark"><IonIcon icon={sparklesOutline} /></div>
          <div><p>RUNMATE AI</p><h1>Ask Your Coach</h1><span>Choose one question. Your answer uses only the RunMate data available right now.</span></div>
        </header>

        {loadingContext && <PageState kind="loading" title="Preparing Your Coaching Context…" className="ai-coach-state" />}
        {!loadingContext && !context && <PageState kind="error" title="Coach Context Is Unavailable" detail={error ?? undefined} actionLabel="Try Again" onAction={() => void loadContext()} className="ai-coach-state" />}

        {!loadingContext && context && <>
          <section className="ai-coach-topics" aria-labelledby="coach-questions-heading">
            <div className="ai-coach-section-heading"><p>COACH QUESTIONS</p><h2 id="coach-questions-heading">Choose A Question</h2><span>Ask one focused question for a clearer answer.</span></div>
            <button type="button" className={`ai-coach-featured${selectedTopic === 'today' ? ' selected' : ''}`} onClick={() => void ask('today')} disabled={asking}>
              <span className="ai-coach-topic-icon"><IonIcon icon={sparklesOutline} /></span>
              <span><strong>{AI_COACH_TOPICS[0].title}</strong><small>{AI_COACH_TOPICS[0].summary}</small></span>
              <span className="ai-coach-ask-label">Ask Coach</span>
            </button>
            <div className="ai-coach-topic-list">
              {AI_COACH_TOPICS.slice(1).map((topic) => <button type="button" className={selectedTopic === topic.id ? 'selected' : ''} onClick={() => void ask(topic.id)} disabled={asking} key={topic.id}>
                <span><strong>{topic.title}</strong><small>{topic.summary}</small></span><span className="ai-coach-row-action">Ask</span>
              </button>)}
            </div>
          </section>

          {asking && <section className="ai-coach-answer-loading" role="status"><IonSpinner name="crescent" /><div><strong>Thinking About Your Data…</strong><span>{activeTopic?.title}</span></div></section>}
          {!asking && error && <PageState kind="error" title="AI Coach Is Unavailable" detail={error} actionLabel={selectedTopic ? 'Try Again' : undefined} onAction={selectedTopic ? () => void ask(selectedTopic) : undefined} className="ai-coach-state" />}
          {!asking && answer && <CoachAnswer answer={answer} topicTitle={activeTopic?.title ?? 'Coach Answer'} onRefresh={() => void ask(answer.topic)} />}

          {!asking && !answer && !error && <p className="ai-coach-privacy"><IonIcon icon={checkmarkCircleOutline} />AI Coach does not change your plan, scores, or saved records.</p>}
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function CoachAnswer({ answer, topicTitle, onRefresh }: { answer: AiCoachAnswer; topicTitle: string; onRefresh: () => void }) {
  return <section className="ai-coach-answer" aria-live="polite">
    <header className="ai-coach-answer-header">
      <div className="ai-coach-answer-label"><IonIcon icon={sparklesOutline} /><span>COACH ANSWER</span></div>
      <span className="ai-coach-answer-topic">{topicTitle}</span>
      <h2>{answer.headline}</h2><p className="ai-coach-summary">{answer.summary}</p>
    </header>
    {answer.actions.length > 0 && <AnswerList title="What To Do" items={answer.actions} numbered />}
    {answer.nextMeal && <div className="ai-coach-next-meal">
      <div className="ai-coach-next-meal-heading"><span>NEXT MEAL</span><h3>{answer.nextMeal.title}</h3>{answer.nextMeal.timing && <p>{answer.nextMeal.timing}</p>}</div>
      <div className="ai-coach-meal-options">{answer.nextMeal.options.map((option, index) => <div key={option}><span>{index + 1}</span><p>{option}</p></div>)}</div>
    </div>}
    {answer.reasons.length > 0 && <AnswerList title="Why" items={answer.reasons} />}
    {answer.missingData.length > 0 && <div className="ai-coach-missing"><div><IonIcon icon={helpCircleOutline} /><strong>Missing Data</strong></div><ul>{answer.missingData.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {answer.caution && <div className="ai-coach-caution"><IonIcon icon={warningOutline} /><span>{answer.caution}</span></div>}
    {answer.followUps.length > 0 && <div className="ai-coach-followups"><strong>Ask Next</strong>{answer.followUps.map((item) => <span key={item}>{item}</span>)}</div>}
    <button type="button" className="ai-coach-refresh" onClick={onRefresh}>Refresh Answer</button>
  </section>;
}

function AnswerList({ title, items, numbered = false }: { title: string; items: string[]; numbered?: boolean }) {
  return <div className={`ai-coach-answer-list${numbered ? ' numbered' : ''}`}><h3>{title}</h3><ol>{items.map((item, index) => <li key={item}><span>{numbered ? index + 1 : '•'}</span><p>{item}</p></li>)}</ol></div>;
}

function message(value: unknown, fallback: string): string { return value instanceof Error && value.message ? value.message : fallback; }

export default AiCoachPage;

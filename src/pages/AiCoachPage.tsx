import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, arrowDownOutline, checkmarkCircleOutline, chevronDownOutline, chevronUpOutline, helpCircleOutline, sendOutline, sparklesOutline, warningOutline } from 'ionicons/icons';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { AI_COACH_TOPICS, askAiCoach, askAiCoachChat, type AiCoachAnswer, type AiCoachTopic } from '@/lib/aiCoach';
import type { CoachContext } from '@/lib/buildCoachContext';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { hapticImpact } from '@/lib/haptics';
import './AiCoachPage.css';

type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  topicTitle?: string;
  answer?: AiCoachAnswer;
  timestamp: string;
  topicId?: AiCoachTopic;
  isError?: boolean;
};

const AiCoachPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadContext = useCallback(async () => {
    setLoadingContext(true); setError(null);
    try { setContext(await buildCoachContextFromSupabase()); }
    catch (failure) { setError(message(failure, 'Your RunMate data could not be loaded.')); }
    finally { setLoadingContext(false); }
  }, []);

  useEffect(() => { void loadContext(); }, [loadContext]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let showHandle: PluginListenerHandle | null = null;
    let hideHandle: PluginListenerHandle | null = null;
    void Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardOffset(info.keyboardHeight);
    }).then((h) => { showHandle = h; });
    void Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardOffset(0);
    }).then((h) => { hideHandle = h; });
    return () => {
      void showHandle?.remove();
      void hideHandle?.remove();
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsNearBottom(true);
  }, []);

  useEffect(() => {
    if (isNearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, asking, isNearBottom]);

  const askTopic = async (topicId: AiCoachTopic) => {
    if (!context || asking) return;
    void hapticImpact();
    const topicInfo = AI_COACH_TOPICS.find((t) => t.id === topicId);
    const questionText = topicInfo?.title ?? 'Ask Coach';
    
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: questionText,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setAsking(true); setError(null);

    try {
      const answer = await askAiCoach(topicId, context);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-coach`,
        sender: 'assistant',
        topicTitle: questionText,
        answer,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (failure) {
      setError(message(failure, 'AI Coach is temporarily unavailable.'));
    } finally {
      setAsking(false);
    }
  };

  const submitCustomQuery = async () => {
    const trimmed = inputQuery.trim();
    if (!trimmed || !context || asking) return;
    setInputQuery('');
    
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setAsking(true); setError(null);

    try {
      const answer = await askAiCoachChat(trimmed, context);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-coach`,
        sender: 'assistant',
        topicTitle: trimmed,
        answer,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (failure) {
      setError(message(failure, 'AI Coach could not process this question.'));
    } finally {
      setAsking(false);
    }
  };

  return <IonPage>
    <IonHeader translucent className="ai-coach-header"><IonToolbar>
      <button type="button" className="ai-coach-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>AI Coach</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="ai-coach-content">
      <main className="ai-coach-shell">
        {loadingContext && <PageDataSkeleton variant="coach" label="Preparing Your Coaching Context" />}
        {!loadingContext && !context && <PageState kind="error" title="Coach Context Is Unavailable" detail={error ?? undefined} actionLabel="Try Again" onAction={() => void loadContext()} className="ai-coach-state" />}

        {!loadingContext && context && <>
          {/* Collapsible Based On Context Drawer */}
          <section className="ai-coach-context-drawer">
            <button type="button" className="ai-coach-drawer-toggle" onClick={() => setShowContextDrawer(!showContextDrawer)}>
              <span className="ai-coach-drawer-title"><IonIcon icon={sparklesOutline} /><strong>Based On Your Data</strong><small>Recovery: {context.recoverySystem.overallScore}%, Strain: {context.recoverySystem.strain.score}/21</small></span>
              <IonIcon icon={showContextDrawer ? chevronUpOutline : chevronDownOutline} />
            </button>
            {showContextDrawer && <div className="ai-coach-drawer-content">
              <div className="ai-coach-context-grid">
                <div><span>Recovery Score</span><strong>{context.recoverySystem.overallScore}% ({context.recoverySystem.overallLabel})</strong></div>
                <div><span>Strain Score</span><strong>{context.recoverySystem.strain.score} / 21</strong></div>
                <div><span>Sleep Performance</span><strong>{context.recoverySystem.sleepPerformance.score}% ({context.recoverySystem.sleepPerformance.label})</strong></div>
                <div><span>Logged Meals Today</span><strong>{context.nutritionToday?.mealCount ?? 0} Meals ({context.nutritionToday?.caloriesKcal ?? 0} kcal)</strong></div>
                {context.activeRaceGoal && <div><span>Active Race Goal</span><strong>{context.raceName} ({context.daysUntilRace} days away)</strong></div>}
              </div>
            </div>}
          </section>

          {/* Chat Messages / Welcome Empty State */}
          <section className="ai-coach-chat-stream" aria-label="Conversation History">
            {messages.length === 0 && <div className="ai-coach-welcome-hero">
              <div className="ai-coach-hero-mark"><IonIcon icon={sparklesOutline} /></div>
              <h2>How can I help your running today?</h2>
              <p>Choose a suggestion below or type any question to receive personal recovery and training guidance.</p>
              
              <div className="ai-coach-prompt-grid">
                {AI_COACH_TOPICS.map((topic) => (
                  <button key={topic.id} type="button" className="ai-coach-prompt-card" onClick={() => void askTopic(topic.id)} disabled={asking}>
                    <strong>{topic.title}</strong>
                    <span>{topic.summary}</span>
                  </button>
                ))}
              </div>
            </div>}

            {messages.length > 0 && <div className="ai-coach-quick-chips">
              <div className="ai-coach-chip-list">
                {AI_COACH_TOPICS.map((topic) => (
                  <button key={topic.id} type="button" className="ai-coach-chip" onClick={() => void askTopic(topic.id)} disabled={asking}>
                    {topic.title}
                  </button>
                ))}
              </div>
            </div>}

            {messages.map((msg) => (
              <div key={msg.id} className={`ai-coach-msg-bubble ${msg.sender}`}>
                {msg.sender === 'user' ? (
                  <div className="ai-coach-user-msg">
                    <p>{msg.text}</p>
                    <time>{msg.timestamp}</time>
                  </div>
                ) : (
                  msg.answer && <CoachAnswer answer={msg.answer} topicTitle={msg.topicTitle ?? 'Coach Answer'} onRefresh={() => void askTopic(msg.answer?.topic ?? 'today')} />
                )}
              </div>
            ))}

            {asking && <section className="ai-coach-answer-loading" role="status"><IonSpinner name="crescent" /><div><strong>Thinking About Your RunMate Data…</strong><span>Analyzing recovery & training load</span></div></section>}
            {!asking && error && <PageState kind="error" title="AI Coach Is Unavailable" detail={error} className="ai-coach-state" />}
            <div ref={chatEndRef} />
          </section>

          {/* Freeform Chat Input Bar */}
          <div className="ai-coach-input-container" style={keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)` } : undefined}>
            {!isNearBottom && (
              <button type="button" className="ai-coach-scroll-bottom-btn" onClick={scrollToBottom} aria-label="Scroll to bottom">
                <IonIcon icon={arrowDownOutline} /> New response below
              </button>
            )}
            <footer className="ai-coach-input-bar">
              <input
                type="text"
                className="ai-coach-chat-input"
                placeholder="Ask AI Coach anything (e.g. หลังวิ่งกินอะไรดี?)..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submitCustomQuery(); }}
                disabled={asking}
              />
              <button type="button" className="ai-coach-send-btn" onClick={() => void submitCustomQuery()} disabled={asking || !inputQuery.trim()} aria-label="Send Message">
                <IonIcon icon={sendOutline} />
              </button>
            </footer>
            <p className="ai-coach-privacy"><IonIcon icon={checkmarkCircleOutline} />AI Coach recommendations are advisory and do not overwrite saved records.</p>
          </div>
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonAlert, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, arrowDownOutline, checkmarkCircleOutline, chevronDownOutline, chevronUpOutline, sendOutline, sparklesOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { DataFreshnessStatus } from '@/components/DataFreshnessStatus';
import { AI_COACH_TOPICS, askAiCoach, askAiCoachChat, type AiCoachAnswer, type AiCoachChatTurn, type AiCoachTopic } from '@/lib/aiCoach';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { hapticImpact } from '@/lib/haptics';
import { loadRecoveryContextStartupEntry, saveRecoveryContextStartupSnapshot } from '@/lib/recoveryStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { recoveryDataStatusCopy, resolveRecoveryDataStatus } from '@/lib/recoveryDataFreshness';
import { guardCoachContextFreshness } from '@/lib/aiCoachFreshness';
import { clearAiCoachChatHistory, loadAiCoachChatHistory, saveAiCoachChatHistory, type AiCoachStoredMessage } from '@/lib/aiCoachChatHistory';
import './AiCoachPage.css';

type ChatMessage = AiCoachStoredMessage;

const AiCoachPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation<{ initialTopic?: AiCoachTopic }>();
  const isPrimaryCoachTab = location.pathname === '/tabs/coach';
  const context = useCoachContextStore((state) => state.context);
  const [startupEntry] = useState(() => loadRecoveryContextStartupEntry());
  const startupContext = startupEntry?.context ?? null;
  const displayContext = context ?? startupContext;
  const [contextSavedAt, setContextSavedAt] = useState<string | null>(() => startupEntry?.savedAt ?? null);
  const [contextRefreshFailed, setContextRefreshFailed] = useState(false);
  const [loadingContext, setLoadingContext] = useState(() => displayContext === null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadAiCoachChatHistory());
  const [clearConversationOpen, setClearConversationOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeContextLoadRef = useRef<Promise<void> | null>(null);
  const initialTopicHandledRef = useRef(false);

  const loadContext = useCallback(async () => {
    if (activeContextLoadRef.current) return activeContextLoadRef.current;
    const operation = (async () => {
      setError(null);
      try {
        const next = await measurePerformanceDiagnostic(
          'ai_coach_context',
          () => buildCoachContextFromSupabase(),
          () => ({ detail: 'Recovery, training, nutrition, and race context prepared' }),
        );
        const savedAt = new Date().toISOString();
        saveRecoveryContextStartupSnapshot(next, savedAt);
        setContextSavedAt(savedAt);
        setContextRefreshFailed(false);
      } catch (failure) {
        setContextRefreshFailed(true);
        setError(message(failure, 'Your RunMate data could not be loaded.'));
      } finally {
        setLoadingContext(false);
      }
    })().finally(() => { activeContextLoadRef.current = null; });
    activeContextLoadRef.current = operation;
    return operation;
  }, []);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => { saveAiCoachChatHistory(messages); }, [messages]);
  const contextDataStatus = resolveRecoveryDataStatus({
    savedAt: contextSavedAt,
    refreshing: loadingContext && Boolean(displayContext),
    refreshFailed: contextRefreshFailed,
  });
  const contextStatusCopy = recoveryDataStatusCopy(contextDataStatus, contextSavedAt);
  const requestContext = displayContext ? guardCoachContextFreshness(displayContext, contextDataStatus) : null;

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsNearBottom(true);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let showHandle: PluginListenerHandle | null = null;
    void Keyboard.addListener('keyboardWillShow', () => {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }).then((h) => { showHandle = h; });
    return () => {
      void showHandle?.remove();
    };
  }, []);

  useEffect(() => {
    if (isNearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, asking, isNearBottom]);

  const askTopic = useCallback(async (topicId: AiCoachTopic, force = false) => {
    if (!requestContext || asking) return;
    const conversation = conversationFromMessages(messages);
    void hapticImpact();
    const topicInfo = AI_COACH_TOPICS.find((t) => t.id === topicId);
    const questionText = topicInfo?.title ?? 'Ask Coach';

    if (!force) {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        sender: 'user',
        text: questionText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
    }
    setAsking(true); setError(null);

    try {
      const answer = await measurePerformanceDiagnostic(
        'ai_coach_answer',
        () => askAiCoach(topicId, requestContext, undefined, { force, conversation }),
        () => ({ detail: force ? 'Topic answer refreshed' : 'Topic answer prepared' }),
      );
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
  }, [asking, messages, requestContext]);

  useEffect(() => {
    const initialTopic = location.state?.initialTopic;
    if (!initialTopic || initialTopicHandledRef.current || !requestContext || asking) return;
    initialTopicHandledRef.current = true;
    history.replace(location.pathname);
    void askTopic(initialTopic);
  }, [askTopic, asking, history, location.pathname, location.state, requestContext]);

  const submitQuestion = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || !requestContext || asking) return;
    const conversation = conversationFromMessages(messages);
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
      const answer = await measurePerformanceDiagnostic(
        'ai_coach_answer',
        () => askAiCoachChat(trimmed, requestContext, conversation),
        () => ({ detail: 'Custom question answered' }),
      );
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
  }, [asking, messages, requestContext]);

  const submitCustomQuery = useCallback(() => submitQuestion(inputQuery), [inputQuery, submitQuestion]);

  return <IonPage>
    <IonHeader translucent className="ai-coach-header"><IonToolbar>
      {!isPrimaryCoachTab && <button type="button" className="ai-coach-back" aria-label="Back" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>}
      <IonTitle>Coach</IonTitle>
      {messages.length > 0 && <button type="button" className="ai-coach-clear" aria-label="Clear Conversation" onClick={() => setClearConversationOpen(true)}><IonIcon icon={trashOutline} /></button>}
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="ai-coach-content">
      <main className="ai-coach-shell">
        {loadingContext && <PageDataSkeleton variant="coach" label="Preparing Your Coaching Context" />}
        {!loadingContext && !displayContext && <PageState kind="error" title="Coach Context Is Unavailable" detail={error ?? undefined} actionLabel="Try Again" onAction={() => void loadContext()} className="ai-coach-state" />}

        {!loadingContext && displayContext && <>
          {/* Collapsible Based On Context Drawer */}
          <section className="ai-coach-context-drawer">
            <button type="button" className="ai-coach-drawer-toggle" aria-expanded={showContextDrawer} onClick={() => setShowContextDrawer(!showContextDrawer)}>
              <span className="ai-coach-drawer-title"><IonIcon icon={sparklesOutline} /><strong>Based On Your Data</strong><small>Recovery: {displayContext.recoverySystem.overallScore}%, Strain: {displayContext.recoverySystem.strain.score}/21</small></span>
              <IonIcon icon={showContextDrawer ? chevronUpOutline : chevronDownOutline} />
            </button>
            {showContextDrawer && <div className="ai-coach-drawer-content">
              <DataFreshnessStatus
                status={contextDataStatus}
                detail={contextStatusCopy.detail}
                note={contextDataStatus === 'stale' || contextDataStatus === 'fallback' ? 'Training-load changes are paused.' : undefined}
                onRetry={() => void loadContext()}
                variant="panel"
                quietWhenFresh
              />
              <div className="ai-coach-context-grid">
                <div><span>Recovery Score</span><strong>{displayContext.recoverySystem.overallScore}% ({displayContext.recoverySystem.overallLabel})</strong></div>
                <div><span>Strain Score</span><strong>{displayContext.recoverySystem.strain.score} / 21</strong></div>
                <div><span>Sleep Performance</span><strong>{displayContext.recoverySystem.sleepPerformance.score}% ({displayContext.recoverySystem.sleepPerformance.label})</strong></div>
                <div><span>Logged Meals Today</span><strong>{displayContext.nutritionToday?.mealCount ?? 0} Meals ({displayContext.nutritionToday?.caloriesKcal ?? 0} kcal)</strong></div>
                {displayContext.activeRaceGoal && <div><span>Active Race Goal</span><strong>{displayContext.raceName} ({displayContext.daysUntilRace} days away)</strong></div>}
              </div>
            </div>}
          </section>

          {/* Chat Messages / Welcome Empty State */}
          <section className="ai-coach-chat-stream" aria-label="Conversation History">
            {messages.length === 0 && <div className="ai-coach-welcome-hero">
              <div className="ai-coach-hero-mark"><IonIcon icon={sparklesOutline} /></div>
              <h2>What would you like to talk about?</h2>
              <p>Ask about training, recovery, food—or anything else. I’ll use your RunMate data only when it helps.</p>
              
              <div className="ai-coach-prompt-grid">
                {AI_COACH_TOPICS.map((topic, index) => (
                  <button key={topic.id} type="button" className="ai-coach-prompt-card" onClick={() => void askTopic(topic.id)} disabled={asking}>
                    {index === 0 && <small>Recommended</small>}
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
                  msg.answer && <CoachAnswer answer={msg.answer} timestamp={msg.timestamp} onFollowUp={(question) => void submitQuestion(question)} />
                )}
              </div>
            ))}

            {asking && <section className="ai-coach-answer-loading" role="status"><IonSpinner name="crescent" /><div><strong>AI Coach is typing…</strong><span>Thinking about your question</span></div></section>}
            {!asking && error && <PageState kind="error" title="AI Coach Is Unavailable" detail={error} className="ai-coach-state" />}
            <div ref={chatEndRef} />
          </section>

          {/* Freeform Chat Input Bar */}
          <div className="ai-coach-input-container">
            {!isNearBottom && (
              <button type="button" className="ai-coach-scroll-bottom-btn" onClick={scrollToBottom} aria-label="Scroll to bottom">
                <IonIcon icon={arrowDownOutline} /> New response below
              </button>
            )}
            <footer className="ai-coach-input-bar">
              <input
                type="text"
                className="ai-coach-chat-input"
                placeholder="ถามอะไรก็ได้ เช่น วันนี้ควรวิ่งไหม…"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submitCustomQuery();
                  }
                }}
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
    <IonAlert
      isOpen={clearConversationOpen}
      onDidDismiss={() => setClearConversationOpen(false)}
      header="Start A New Chat?"
      message="This clears the AI Coach conversation stored on this device."
      buttons={[
        { text: 'Cancel', role: 'cancel' },
        { text: 'Clear Chat', role: 'destructive', handler: () => { clearAiCoachChatHistory(); setMessages([]); } },
      ]}
    />
  </IonPage>;
};

function CoachAnswer({ answer, timestamp, onFollowUp }: { answer: AiCoachAnswer; timestamp: string; onFollowUp: (question: string) => void }) {
  return <article className="ai-coach-assistant-message" aria-live="polite">
    <div className="ai-coach-assistant-mark" aria-hidden="true"><IonIcon icon={sparklesOutline} /></div>
    <div className="ai-coach-assistant-body">
      <p className="ai-coach-conversation-text">{answer.message}</p>
      {answer.caution && <div className="ai-coach-chat-caution"><IonIcon icon={warningOutline} /><span>{answer.caution}</span></div>}
      {answer.missingData.length > 0 && <details className="ai-coach-chat-missing">
        <summary>ข้อมูลที่ยังไม่มี ({answer.missingData.length})</summary>
        <ul>{answer.missingData.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>}
      {answer.followUps.length > 0 && <div className="ai-coach-chat-followups" aria-label="Suggested follow-up questions">
        {answer.followUps.map((item) => <button key={item} type="button" onClick={() => onFollowUp(item)}>{item}</button>)}
      </div>}
      <time>{timestamp}</time>
    </div>
  </article>;
}

function conversationFromMessages(messages: ChatMessage[]): AiCoachChatTurn[] {
  return messages.flatMap((item): AiCoachChatTurn[] => {
    const content = item.sender === 'user' ? item.text : item.answer?.message;
    if (!content?.trim()) return [];
    return [{ role: item.sender, content: content.trim() }];
  }).slice(-8);
}

function message(value: unknown, fallback: string): string { return value instanceof Error && value.message ? value.message : fallback; }

export default AiCoachPage;

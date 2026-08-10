import { beforeEach, describe, expect, it } from 'vitest';
import { clearAiCoachChatHistory, loadAiCoachChatHistory, saveAiCoachChatHistory, type AiCoachStoredMessage } from '@/lib/aiCoachChatHistory';

const userMessage: AiCoachStoredMessage = { id: 'u1', sender: 'user', text: 'How did I sleep?', timestamp: '07:00 AM' };

describe('AI Coach chat history', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists valid messages across page visits', () => {
    saveAiCoachChatHistory([userMessage]);
    expect(loadAiCoachChatHistory()).toEqual([userMessage]);
  });

  it('ignores malformed stored values and clears on request', () => {
    window.localStorage.setItem('runmate:ai-coach-chat:v1', JSON.stringify([{ sender: 'user' }]));
    expect(loadAiCoachChatHistory()).toEqual([]);
    saveAiCoachChatHistory([userMessage]);
    clearAiCoachChatHistory();
    expect(loadAiCoachChatHistory()).toEqual([]);
  });
});

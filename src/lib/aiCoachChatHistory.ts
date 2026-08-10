import type { AiCoachAnswer, AiCoachTopic } from '@/lib/aiCoach';

const STORAGE_KEY = 'runmate:ai-coach-chat:v1';
const MAX_MESSAGES = 100;

export type AiCoachStoredMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  topicTitle?: string;
  answer?: AiCoachAnswer;
  timestamp: string;
  topicId?: AiCoachTopic;
  isError?: boolean;
};

export function loadAiCoachChatHistory(): AiCoachStoredMessage[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validMessage).slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export function saveAiCoachChatHistory(messages: AiCoachStoredMessage[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.filter(validMessage).slice(-MAX_MESSAGES)));
  } catch {
    // Chat remains usable when device storage is unavailable.
  }
}

export function clearAiCoachChatHistory(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Ignore unavailable storage. */ }
}

function validMessage(value: unknown): value is AiCoachStoredMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<AiCoachStoredMessage>;
  if (typeof message.id !== 'string' || (message.sender !== 'user' && message.sender !== 'assistant') || typeof message.timestamp !== 'string') return false;
  if (message.sender === 'user') return typeof message.text === 'string' && Boolean(message.text.trim());
  return Boolean(message.answer && typeof message.answer === 'object' && typeof message.answer.message === 'string');
}

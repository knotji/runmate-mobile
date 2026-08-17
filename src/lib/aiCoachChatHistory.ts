import type { AiCoachAnswer, AiCoachTopic } from '@/lib/aiCoach';
import { getBangkokDateKey, todayBangkokDateKey, yesterdayBangkokDateKey } from '@/lib/date';

const STORAGE_KEY = 'runmate:ai-coach-chat:v1';
const MAX_MESSAGES = 100;

export type AiCoachStoredMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  topicTitle?: string;
  answer?: AiCoachAnswer;
  timestamp: string;
  /** Bangkok date-key the message was sent on. Optional so messages saved before this field existed keep loading — see `resolveMessageDateKey`. */
  dateKey?: string;
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

/**
 * The `id` RunMate assigns each message already embeds the exact instant it was created
 * (`msg-<epoch>-user`/`msg-<epoch>-coach`), so a message saved before the `dateKey` field
 * existed can still be placed on the correct day rather than falling back to "today".
 */
export function resolveMessageDateKey(message: Pick<AiCoachStoredMessage, 'dateKey' | 'id'>): string {
  if (message.dateKey) return message.dateKey;
  const embeddedEpoch = /^msg-(\d+)-/.exec(message.id)?.[1];
  return embeddedEpoch ? getBangkokDateKey(Number(embeddedEpoch)) : todayBangkokDateKey();
}

export function formatChatDateDivider(dateKey: string): string {
  if (dateKey === todayBangkokDateKey()) return 'Today';
  if (dateKey === yesterdayBangkokDateKey()) return 'Yesterday';
  const sameYear = dateKey.slice(0, 4) === todayBangkokDateKey().slice(0, 4);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric', timeZone: 'Asia/Bangkok' })
    .format(new Date(`${dateKey}T12:00:00+07:00`));
}

function validMessage(value: unknown): value is AiCoachStoredMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<AiCoachStoredMessage>;
  if (typeof message.id !== 'string' || (message.sender !== 'user' && message.sender !== 'assistant') || typeof message.timestamp !== 'string') return false;
  if (message.sender === 'user') return typeof message.text === 'string' && Boolean(message.text.trim());
  return Boolean(message.answer && typeof message.answer === 'object' && typeof message.answer.message === 'string');
}

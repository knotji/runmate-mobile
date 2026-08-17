import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAiCoachChatHistory,
  formatChatDateDivider,
  loadAiCoachChatHistory,
  resolveMessageDateKey,
  saveAiCoachChatHistory,
  type AiCoachStoredMessage,
} from '@/lib/aiCoachChatHistory';

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

describe('resolveMessageDateKey', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('uses the stored dateKey when present', () => {
    expect(resolveMessageDateKey({ dateKey: '2026-08-10', id: 'msg-9999999999999-user' })).toBe('2026-08-10');
  });

  it('falls back to the epoch embedded in the id for messages saved before dateKey existed', () => {
    // 2026-08-13T10:00:00+07:00
    const epoch = Date.parse('2026-08-13T03:00:00.000Z');
    expect(resolveMessageDateKey({ id: `msg-${epoch}-coach` })).toBe('2026-08-13');
  });

  it('falls back to today only when the id has no embedded epoch either, rather than inventing one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T06:00:00.000Z')); // 2026-08-15T13:00:00+07:00
    expect(resolveMessageDateKey({ id: 'not-a-runmate-message-id' })).toBe('2026-08-15');
  });
});

describe('formatChatDateDivider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T06:00:00.000Z')); // 2026-08-15T13:00:00+07:00
  });
  afterEach(() => { vi.useRealTimers(); });

  it('labels today and yesterday by name instead of a date', () => {
    expect(formatChatDateDivider('2026-08-15')).toBe('Today');
    expect(formatChatDateDivider('2026-08-14')).toBe('Yesterday');
  });

  it('labels an older same-year date without repeating the year', () => {
    expect(formatChatDateDivider('2026-08-01')).toBe('Aug 1');
  });

  it('includes the year for a date from a different year', () => {
    expect(formatChatDateDivider('2025-08-01')).toBe('Aug 1, 2025');
  });
});

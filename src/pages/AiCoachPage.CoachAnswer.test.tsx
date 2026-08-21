import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { AiCoachAnswer } from '@/lib/aiCoach';

const formatCoachMessageSpy = vi.fn((message: string) => <p>{message}</p>);
vi.mock('@/lib/coachMessageFormatting', () => ({
  formatCoachMessage: (...args: [string]) => formatCoachMessageSpy(...args),
}));

import { CoachAnswer } from '@/pages/AiCoachPage';

function answer(message: string): AiCoachAnswer {
  return {
    topic: 'training_readiness',
    message,
    headline: '',
    summary: '',
    actions: [],
    reasons: [],
    missingData: [],
    caution: null,
    nextMeal: null,
    followUps: [],
    generatedAt: '2026-08-20T00:00:00.000Z',
  } as unknown as AiCoachAnswer;
}

// AiCoachPage re-renders on every keystroke in the chat input, which
// re-renders every already-sent CoachAnswer in the conversation, not just
// the one being typed. This harness stands in for that: a sibling counter
// changes (like inputQuery would) while `answer` itself stays the same
// object, the same way a previously-sent chat message never changes once
// it's rendered.
function Harness({ initialMessage }: { initialMessage: string }) {
  const [tick, setTick] = useState(0);
  const [fixedAnswer] = useState(() => answer(initialMessage));
  return <div>
    <button type="button" onClick={() => setTick((value) => value + 1)}>Bump {tick}</button>
    <CoachAnswer answer={fixedAnswer} timestamp="10:00" onFollowUp={() => undefined} />
  </div>;
}

describe('CoachAnswer', () => {
  it('does not re-parse an already-rendered message when an unrelated sibling re-renders', () => {
    render(<Harness initialMessage="Today's plan: - Easy 5k - Strength" />);

    expect(formatCoachMessageSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/Bump/));
    fireEvent.click(screen.getByText(/Bump/));

    expect(formatCoachMessageSpy).toHaveBeenCalledTimes(1);
  });
});

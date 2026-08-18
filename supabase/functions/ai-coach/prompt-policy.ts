export const COACH_ORIGINS = ['today', 'health', 'move', 'you', 'unknown'] as const;
export type CoachOrigin = typeof COACH_ORIGINS[number];

export function normalizeCoachOrigin(value: unknown): CoachOrigin {
  return typeof value === 'string' && COACH_ORIGINS.includes(value as CoachOrigin)
    ? value as CoachOrigin
    : 'unknown';
}

export function originInstruction(origin: CoachOrigin): string {
  const priority = origin === 'today'
    ? 'Prioritize one practical daily action when the question is ambiguous.'
    : origin === 'health'
      ? 'Prioritize measured health signals, trends, provenance, and uncertainty when the question is ambiguous.'
      : origin === 'move'
        ? 'Prioritize recorded or planned movement when the question is ambiguous.'
        : 'Do not infer a topic from the originating surface.';
  return `Originating surface: ${origin}. ${priority} Navigation context is not proof of user intent, and the explicit current question always wins.`;
}

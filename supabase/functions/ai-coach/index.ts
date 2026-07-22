import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const TOPICS = ['today', 'recovery', 'adjust', 'fuel', 'race', 'chat'] as const;
type Topic = typeof TOPICS[number];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return reply({ error: 'Authentication Required' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return reply({ error: 'Authentication Required' }, 401);

    const body = await request.json();
    const topic = TOPICS.includes(body.topic) ? body.topic as Topic : null;
    if (!topic) return reply({ error: 'Choose A Supported Coach Question' }, 400);
    const userQuery = typeof body.userQuery === 'string' && body.userQuery.trim() ? body.userQuery.trim().slice(0, 1000) : null;
    const context = compact(body.context);
    if (JSON.stringify(context).length > 20_000) return reply({ error: 'Coach Context Is Too Large' }, 413);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return reply({ error: 'AI Coach Is Not Configured' }, 503);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite'}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(topic, context, userQuery) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });
    if (!response.ok) {
      console.error('[ai-coach] Gemini request failed', response.status);
      return reply({ error: 'AI Coach Is Temporarily Unavailable' }, 502);
    }
    const generated = await response.json();
    const text = generated?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return reply({ error: 'AI Coach Returned An Empty Answer' }, 502);
    return reply({ data: normalizeAnswer(JSON.parse(text)) });
  } catch (error) {
    console.error('[ai-coach]', error);
    return reply({ error: 'AI Coach Could Not Complete This Request' }, 500);
  }
});

function prompt(topic: Topic, context: unknown, userQuery: string | null): string {
  const queryPrompt = userQuery ? `User custom question: ${userQuery}` : `Selected question: ${topicInstruction(topic)}`;
  return `You are RunMate AI Coach, a cautious running and recovery assistant.

${queryPrompt}
Trusted compact context: ${JSON.stringify(context)}

Rules:
- Write every visible answer string in natural, concise Thai. Keep JSON keys in English.
- Use only facts present in the compact context. Never invent wearable values, nutrition targets, diagnoses, or completed workouts.
- Duration values such as 4h 19m are display-ready. Translate them naturally as 4 ชม. 19 นาที; never convert them to a raw total such as 259 minutes.
- When comparing Sleep Duration with Sleep Need, use the supplied sleepShortfall and describe it as one contributing factor, not as certain medical causation.
- Clearly mention important missing data when it limits confidence.
- Pain or illness always takes priority over performance advice. Recommend professional care only when appropriate; do not diagnose.
- This is a recommendation only. Never claim that you changed a Race Plan, Recovery score, stored record, or notification.
- Give one clear headline, a short summary, and no more than four practical actions.
- For the fuel topic, always include nextMeal with a useful title, sensible timing, and 2-3 concrete Thai meal options based on what is already logged. Use familiar portions such as one plate, one bowl, eggs, palm-sized protein, or fruit; do not invent exact calories or macro targets.
- For non-fuel topics, return nextMeal as null.
- Keep each action and reason to one sentence.

Return JSON only:
{"headline":"","summary":"","actions":[""],"reasons":[""],"missingData":[""],"caution":null,"nextMeal":{"title":"","timing":"","options":[""]},"followUps":[""]}`;
}

function topicInstruction(topic: Topic): string {
  if (topic === 'today') return 'Choose the single highest-value action for today using Recovery, today plan, completed activity, nutrition, race, pain, and illness context.';
  if (topic === 'recovery') return 'Explain today\'s Recovery state and the available reasons behind it. Do not imply a day-over-day change unless supplied.';
  if (topic === 'adjust') return 'Compare today\'s planned workout, completed activity, adaptive recommendation, Recovery, pain, and illness. Say whether to keep, reduce, swap, or rest.';
  if (topic === 'fuel') return 'Give practical fueling guidance from today\'s logged nutrition and training, then answer what the user should eat next with concrete Thai meal choices. Do not invent calorie or macro targets.';
  return 'Assess whether recent training and the current plan support the Race Goal. Do not rebuild or modify the plan.';
}

function compact(value: unknown) {
  const input = obj(value);
  return {
    date: str(input.date, 20),
    recovery: cleanRecord(input.recovery),
    todayPlan: cleanRecord(input.todayPlan),
    todayWorkouts: cleanArray(input.todayWorkouts, 6),
    recentTraining: cleanRecord(input.recentTraining),
    nutritionToday: cleanRecord(input.nutritionToday),
    race: cleanRecord(input.race),
    health: cleanRecord(input.health),
  };
}

function normalizeAnswer(value: unknown) {
  const answer = obj(value);
  return {
    headline: str(answer.headline, 180) ?? 'ยังไม่มีคำแนะนำที่เชื่อถือได้',
    summary: str(answer.summary, 600) ?? 'ลองใหม่เมื่อ RunMate มีข้อมูลล่าสุดมากขึ้น',
    actions: strings(answer.actions, 4, 220),
    reasons: strings(answer.reasons, 4, 220),
    missingData: strings(answer.missingData, 4, 160),
    caution: str(answer.caution, 260),
    nextMeal: normalizeNextMeal(answer.nextMeal),
    followUps: strings(answer.followUps, 3, 140),
  };
}

function cleanRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  const source = obj(value); const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source).slice(0, 30)) result[key] = cleanValue(item);
  return result;
}
function cleanArray(value: unknown, max: number): unknown[] { return Array.isArray(value) ? value.slice(0, max).map(cleanValue) : []; }
function cleanValue(value: unknown): unknown {
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 12).map(cleanValue);
  return cleanRecord(value);
}
function normalizeNextMeal(value: unknown) {
  const meal = obj(value); const title = str(meal.title, 140); const options = strings(meal.options, 3, 220);
  return title && options.length ? { title, timing: str(meal.timing, 140), options } : null;
}
function strings(value: unknown, max: number, length: number): string[] { return Array.isArray(value) ? value.map((item) => str(item, length)).filter((item): item is string => Boolean(item)).slice(0, max) : []; }
function str(value: unknown, length: number): string | null { return typeof value === 'string' && value.trim() ? value.trim().slice(0, length) : null; }
function obj(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }

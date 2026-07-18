import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication Required' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Authentication Required' }, 401);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'Meal Analysis Is Not Configured' }, 503);
    const body = await request.json();
    const imageDataUrls = Array.isArray(body.imageDataUrls) ? body.imageDataUrls.filter((image: unknown): image is string => typeof image === 'string').slice(0, 4) : [];
    const matches = imageDataUrls.map((image: string) => image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/));
    if (!matches.length || matches.some((match) => !match)) return json({ error: 'Choose Between 1 And 4 Valid Food Images' }, 400);
    const mealType = typeof body.mealType === 'string' ? body.mealType : 'meal';
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : '';
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt(mealType, note, matches.length) }, ...matches.map((match) => ({ inlineData: { mimeType: match![1], data: match![2] } }))] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
    });
    if (!response.ok) return json({ error: 'Meal Analysis Failed' }, 502);
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return json({ error: 'Meal Analysis Returned No Result' }, 502);
    return json({ data: normalize(JSON.parse(text), mealType, note, matches.length) });
  } catch (error) {
    console.error('[analyze-meal]', error);
    return json({ error: 'Meal Analysis Failed' }, 500);
  }
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function prompt(mealType: string, note: string, imageCount: number) { return `Analyze these ${imageCount} photo(s) of one ${mealType} meal for a Thai-speaking runner. Multiple photos may show different angles or different dishes from the same meal. Combine them into one meal and do not count the same visible food twice. ${note ? `User note: ${note}` : ''}

Return JSON only with: detectedFoods array of {name, portionEstimate, quantity, unit}; nutrition {caloriesKcal, proteinG, carbsG, fatG, fiberG}; trainingFit {hydrationNote, coachNote}; confidence low|medium|high; unclearFields string array; needsReview boolean.

Language requirements:
- Write every detected food name in natural Thai.
- Write portionEstimate and unit in Thai.
- Write hydrationNote, coachNote, and unclearFields in Thai.
- Keep JSON property names and enum values in English exactly as specified.

Use null for nutrition that cannot be estimated. Never invent foods that are not visible. Clearly describe uncertainty in Thai instead of presenting uncertain nutrition as exact.`; }
function normalize(value: unknown, mealType: string, note: string, imageCount: number) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nutrition = data.nutrition && typeof data.nutrition === 'object' ? data.nutrition as Record<string, unknown> : {};
  const trainingFit = data.trainingFit && typeof data.trainingFit === 'object' ? data.trainingFit as Record<string, unknown> : {};
  const numberOrNull = (input: unknown) => typeof input === 'number' && Number.isFinite(input) ? input : null;
  return { mealType, mealSlot: mealType, inputMode: 'image', imageCount, note: note || undefined,
    detectedFoods: Array.isArray(data.detectedFoods) ? data.detectedFoods.filter((food) => food && typeof food === 'object' && typeof (food as Record<string, unknown>).name === 'string') : [],
    nutrition: { caloriesKcal: numberOrNull(nutrition.caloriesKcal), proteinG: numberOrNull(nutrition.proteinG), carbsG: numberOrNull(nutrition.carbsG), fatG: numberOrNull(nutrition.fatG), fiberG: numberOrNull(nutrition.fiberG) },
    trainingFit: { hydrationNote: typeof trainingFit.hydrationNote === 'string' ? trainingFit.hydrationNote : '', coachNote: typeof trainingFit.coachNote === 'string' ? trainingFit.coachNote : '' },
    confidence: ['low', 'medium', 'high'].includes(String(data.confidence)) ? data.confidence : 'low', unclearFields: Array.isArray(data.unclearFields) ? data.unclearFields : [], needsReview: data.needsReview !== false,
  };
}

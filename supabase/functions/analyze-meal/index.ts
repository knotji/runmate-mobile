import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasMealSignals, mealPrompt, normalizeMealAnalysis, parseMealRequestBody } from './meal-analysis.ts';

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
    let parsed;
    try { parsed = parseMealRequestBody(await request.json()); }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid Meal Request' }, 400); }
    const { imageMatches: matches, mealText, mealType, note } = parsed;
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: mealPrompt(mealType, note, mealText, matches.length) }, ...matches.map((match) => ({ inlineData: { mimeType: match[1], data: match[2] } }))] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
    });
    if (!response.ok) return json({ error: 'Meal Analysis Failed' }, 502);
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return json({ error: 'Meal Analysis Returned No Result' }, 502);
    const normalized = normalizeMealAnalysis(JSON.parse(text), mealType, note, mealText, matches.length);
    if (!hasMealSignals(normalized)) return json({ error: 'Could Not Identify Food In This Meal. Try A Clearer Photo Or Type What You Ate.' }, 422);
    return json({ data: normalized });
  } catch (error) {
    console.error('[analyze-meal]', error);
    return json({ error: 'Meal Analysis Failed' }, 500);
  }
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

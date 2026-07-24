import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// Deletes everything RunMate stores for the calling account: every row this
// user owns across all Supabase tables, then the Supabase Auth user itself.
// This is destructive and irreversible. It requires SUPABASE_SERVICE_ROLE_KEY
// as a function secret (the anon key alone cannot delete an Auth user or
// bypass RLS to guarantee full row removal), so it must run server-side here
// rather than from the mobile client.
const USER_ID_OWNED_TABLES = ['history_items', 'race_goals', 'training_plans', 'race_results'] as const;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method Not Allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return reply({ error: 'Authentication Required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey) return reply({ error: 'Account Deletion Is Not Configured' }, 503);
    if (!serviceRoleKey) return reply({ error: 'Account Deletion Is Not Configured' }, 503);

    // Identify the caller using their own token; never trust a user id from the request body.
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return reply({ error: 'Authentication Required' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    for (const table of USER_ID_OWNED_TABLES) {
      const { error } = await adminClient.from(table).delete().eq('user_id', user.id);
      if (error) return reply({ error: `Could Not Delete ${table}: ${error.message}` }, 500);
    }

    const { error: profileError } = await adminClient.from('profiles').delete().eq('id', user.id);
    if (profileError) return reply({ error: `Could Not Delete profile: ${profileError.message}` }, 500);

    const { error: authError } = await adminClient.auth.admin.deleteUser(user.id);
    if (authError) return reply({ error: authError.message }, 500);

    return reply({ data: { deleted: true } });
  } catch (error) {
    console.error('[delete-account]', error);
    return reply({ error: 'Account Deletion Failed' }, 500);
  }
});

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

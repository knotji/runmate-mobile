import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

/** Compat wrapper matching runmate-ai's `@/lib/supabase/client` factory shape. */
export function createClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return supabase;
}

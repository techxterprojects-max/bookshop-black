
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase credentials are missing. Check .env.local.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(url, anonKey);
  }

  return supabaseClient;
}

import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.\n' +
      'Copy .env.local.example to .env.local and fill in your Supabase credentials.'
    );
  }

  return createClient(url, key);
}

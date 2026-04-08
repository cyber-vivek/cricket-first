import { NextResponse } from 'next/server';
import { createServerClient } from './supabase';

/**
 * Verifies that admin_id belongs to an admin player.
 * Returns a NextResponse error if not, or null if the check passes.
 */
export async function requireAdmin(admin_id: unknown): Promise<NextResponse | null> {
  if (!admin_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from('players')
    .select('is_admin')
    .eq('id', admin_id)
    .single();

  if (!data?.is_admin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  return null;
}

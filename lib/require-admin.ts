import { NextResponse } from 'next/server';
import { createServerClient } from './supabase';

async function fetchRole(admin_id: unknown): Promise<string | null> {
  if (!admin_id) return null;

  const supabase = createServerClient();
  const { data } = await supabase
    .from('players')
    .select('role')
    .eq('id', admin_id)
    .single();

  return data?.role ?? null;
}

/**
 * Verifies that admin_id belongs to a full admin player.
 * Use for money management (top-up approvals, manual balance, PIN, deactivate).
 */
export async function requireAdmin(admin_id: unknown): Promise<NextResponse | null> {
  if (!admin_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = await fetchRole(admin_id);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  return null;
}

/**
 * Verifies that admin_id belongs to an admin or game_admin.
 * Use for game-management routes (matches, activities) — money handling still
 * requires requireAdmin.
 */
export async function requireGameAdmin(admin_id: unknown): Promise<NextResponse | null> {
  if (!admin_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = await fetchRole(admin_id);
  if (role !== 'admin' && role !== 'game_admin') {
    return NextResponse.json({ error: 'Forbidden: game admin access required' }, { status: 403 });
  }

  return null;
}

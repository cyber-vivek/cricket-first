import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/require-admin';
import { hashPin } from '@/lib/hash';

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServerClient();

  const [playerRes, txRes] = await Promise.all([
    supabase
      .from('player_balances')
      .select('id, name, phone, role, is_admin, created_at, balance')
      .eq('id', id)
      .single(),
    supabase
      .from('transactions')
      .select('id, amount, type, status, notes, reference_id, created_at, approved_at')
      .eq('player_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (playerRes.error) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...playerRes.data,
    transactions: txRes.data ?? [],
  });
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServerClient();
  const body = await req.json();

  // Toggle active/inactive — admin only
  if (body.action === 'deactivate' || body.action === 'activate') {
    const authError = await requireAdmin(body.admin_id);
    if (authError) return authError;

    if (id === body.admin_id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    const { error } = await supabase
      .from('players')
      .update({ deactivated_at: body.action === 'deactivate' ? new Date().toISOString() : null })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Change PIN — admin only, only for admin players
  if (body.action === 'change_pin') {
    const authError = await requireAdmin(body.admin_id);
    if (authError) return authError;

    if (!body.new_pin?.trim()) {
      return NextResponse.json({ error: 'New PIN is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('players')
      .update({ pin: hashPin(body.new_pin, id) })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Change role (promote/demote game_admin) — admin only
  if (body.action === 'set_role') {
    const authError = await requireAdmin(body.admin_id);
    if (authError) return authError;

    const newRole = body.new_role;
    if (newRole !== 'player' && newRole !== 'game_admin') {
      // Full 'admin' promotion is not exposed via this action — keep it manual.
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (id === body.admin_id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Don't allow this action to demote a full admin — separate concern.
    const { data: target } = await supabase
      .from('players')
      .select('role')
      .eq('id', id)
      .single();
    if (target?.role === 'admin') {
      return NextResponse.json({ error: 'Cannot change role of a full admin' }, { status: 400 });
    }

    // Promoting to game_admin needs a PIN (same reasoning as admin: financial writes)
    if (newRole === 'game_admin' && !body.new_pin?.trim()) {
      return NextResponse.json({ error: 'PIN is required to promote to game admin' }, { status: 400 });
    }

    const update: { role: string; is_admin: boolean; pin?: string | null } = {
      role: newRole,
      is_admin: false,
    };
    if (newRole === 'game_admin') {
      update.pin = hashPin(body.new_pin, id);
    } else {
      // Demoting back to player — clear the PIN so the account is phone-only again
      update.pin = null;
    }

    const { error } = await supabase.from('players').update(update).eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Update name/phone
  const { name, phone } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('players')
    .update({ name: name.trim(), phone: phone?.trim() || null })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/require-admin';

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServerClient();

  const [playerRes, txRes] = await Promise.all([
    supabase
      .from('player_balances')
      .select('id, name, phone, is_admin, created_at, balance')
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

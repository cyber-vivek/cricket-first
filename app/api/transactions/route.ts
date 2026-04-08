import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);

  let query = supabase
    .from('transactions')
    .select('*, players ( id, name )')
    .order('created_at', { ascending: false });

  const status = searchParams.get('status');
  const player_id = searchParams.get('player_id');
  const type = searchParams.get('type');

  if (status) query = query.eq('status', status);
  if (player_id) query = query.eq('player_id', player_id);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  // activity_type: 'add' (credit) | 'refund' (debit) — only for admin_direct
  const { player_id, amount, notes, proof_url, admin_direct, activity_type } = await req.json();

  if (!player_id || !amount || Number(amount) <= 0) {
    return NextResponse.json(
      { error: 'Player and a positive amount are required' },
      { status: 400 }
    );
  }

  // Non-admin requests: enforce max 3 pending requests per player
  if (!admin_direct) {
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', player_id)
      .eq('status', 'PENDING');

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'You already have 3 pending requests. Wait for admin to approve them first.' },
        { status: 400 }
      );
    }
  }

  const status = admin_direct ? 'APPROVED' : 'PENDING';
  const type = admin_direct ? 'ADJUSTMENT' : 'TOPUP';

  // Refund = negative amount (money returned to player is still a debit on the ledger)
  const isRefund = admin_direct && activity_type === 'refund';
  const signedAmount = isRefund ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      player_id,
      amount: signedAmount,
      type,
      status,
      notes: notes?.trim() || null,
      proof_url: proof_url?.trim() || null,
      approved_at: admin_direct ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

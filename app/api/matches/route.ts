import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      match_players (
        id,
        player_id,
        cost_share,
        players ( id, name )
      )
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { date, total_cost, player_ids, notes, admin_id } = await req.json();

  const authError = await requireAdmin(admin_id);
  if (authError) return authError;

  if (!date || !total_cost || !Array.isArray(player_ids) || player_ids.length === 0) {
    return NextResponse.json(
      { error: 'Date, total cost and at least one player are required' },
      { status: 400 }
    );
  }

  // Round to 2 decimal places to avoid floating-point issues
  const perPerson =
    Math.round((Number(total_cost) / player_ids.length) * 100) / 100;

  // 1. Create match record
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({ date, total_cost: Number(total_cost), notes: notes?.trim() || null })
    .select()
    .single();

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  // 2. Create match_players records
  const matchPlayersRows = player_ids.map((pid: string) => ({
    match_id: match.id,
    player_id: pid,
    cost_share: perPerson,
  }));

  const { error: mpError } = await supabase
    .from('match_players')
    .insert(matchPlayersRows);

  if (mpError) {
    return NextResponse.json({ error: mpError.message }, { status: 500 });
  }

  // 3. Create APPROVED MATCH transactions (negative amount = deduction)
  const txRows = player_ids.map((pid: string) => ({
    player_id: pid,
    amount: -perPerson,
    type: 'MATCH',
    status: 'APPROVED',
    reference_id: match.id,
    notes: `Match on ${date} – ₹${perPerson} deducted`,
    approved_at: new Date().toISOString(),
  }));

  const { error: txError } = await supabase.from('transactions').insert(txRows);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  return NextResponse.json(match, { status: 201 });
}

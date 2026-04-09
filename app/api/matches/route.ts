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
  const { date, total_cost, player_shares, notes, admin_id } = await req.json();

  const authError = await requireAdmin(admin_id);
  if (authError) return authError;

  if (!date || !total_cost || !Array.isArray(player_shares) || player_shares.length === 0) {
    return NextResponse.json(
      { error: 'Date, total cost and at least one player are required' },
      { status: 400 }
    );
  }

  const effectivePlayerIds: string[] = player_shares.map(
    (s: { player_id: string; amount: number }) => s.player_id
  );

  // Build per-player amount map
  const amountMap: Record<string, number> = {};
  for (const s of player_shares as { player_id: string; amount: number }[]) {
    const amt = Number(s.amount);
    if (!s.player_id || isNaN(amt) || amt <= 0) {
      return NextResponse.json(
        { error: 'Each player share must have a valid player_id and a positive amount' },
        { status: 400 }
      );
    }
    amountMap[s.player_id] = Math.round(amt * 100) / 100;
  }

  const sharesTotal = Object.values(amountMap).reduce((sum, v) => sum + v, 0);
  if (Math.abs(sharesTotal - Number(total_cost)) > 0.5) {
    return NextResponse.json(
      { error: `Player shares (₹${sharesTotal.toFixed(2)}) must add up to total cost (₹${Number(total_cost).toFixed(2)})` },
      { status: 400 }
    );
  }

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
  const matchPlayersRows = effectivePlayerIds.map((pid: string) => ({
    match_id: match.id,
    player_id: pid,
    cost_share: amountMap[pid],
  }));

  const { error: mpError } = await supabase
    .from('match_players')
    .insert(matchPlayersRows);

  if (mpError) {
    return NextResponse.json({ error: mpError.message }, { status: 500 });
  }

  // 3. Create APPROVED MATCH transactions (negative amount = deduction)
  const now = new Date().toISOString();
  const txRows = effectivePlayerIds.map((pid: string) => ({
    player_id: pid,
    amount: -amountMap[pid],
    type: 'MATCH',
    status: 'APPROVED',
    reference_id: match.id,
    notes: `Match on ${date} – ₹${amountMap[pid]} deducted`,
    approved_at: now,
  }));

  // Admin paid on behalf of everyone — offset their share so their net stays zero
  if (effectivePlayerIds.includes(admin_id)) {
    txRows.push({
      player_id: admin_id,
      amount: amountMap[admin_id],
      type: 'ADJUSTMENT',
      status: 'APPROVED',
      reference_id: match.id,
      notes: `Match on ${date} – admin share offset (paid by admin)`,
      approved_at: now,
    });
  }

  const { error: txError } = await supabase.from('transactions').insert(txRows);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  return NextResponse.json(match, { status: 201 });
}

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireGameAdmin } from '@/lib/require-admin';

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { date, total_cost, player_shares, notes, admin_id } = await req.json();

  const authError = await requireGameAdmin(admin_id);
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

  // Confirm the match exists before rebuilding
  const { data: existing, error: fetchError } = await supabase
    .from('matches')
    .select('id')
    .eq('id', id)
    .single();
  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  // Rebuild strategy: clear the old participants and linked transactions, then re-insert.
  // Scoped deletes (id/reference_id + type filter) so we never touch unrelated rows.
  const { error: delMpError } = await supabase
    .from('match_players')
    .delete()
    .eq('match_id', id);
  if (delMpError) {
    return NextResponse.json({ error: delMpError.message }, { status: 500 });
  }

  const { error: delTxError } = await supabase
    .from('transactions')
    .delete()
    .eq('reference_id', id)
    .in('type', ['MATCH', 'ADJUSTMENT']);
  if (delTxError) {
    return NextResponse.json({ error: delTxError.message }, { status: 500 });
  }

  // Update the match row itself
  const { error: updError } = await supabase
    .from('matches')
    .update({
      date,
      total_cost: Number(total_cost),
      notes: notes?.trim() || null,
    })
    .eq('id', id);
  if (updError) {
    return NextResponse.json({ error: updError.message }, { status: 500 });
  }

  // Re-insert match_players
  const matchPlayersRows = effectivePlayerIds.map((pid: string) => ({
    match_id: id,
    player_id: pid,
    cost_share: amountMap[pid],
  }));
  const { error: mpError } = await supabase
    .from('match_players')
    .insert(matchPlayersRows);
  if (mpError) {
    return NextResponse.json({ error: mpError.message }, { status: 500 });
  }

  // Re-insert APPROVED MATCH transactions (negative = deduction)
  const now = new Date().toISOString();
  const txRows = effectivePlayerIds.map((pid: string) => ({
    player_id: pid,
    amount: -amountMap[pid],
    type: 'MATCH',
    status: 'APPROVED',
    reference_id: id,
    notes: `Match on ${date} – ₹${amountMap[pid]} deducted`,
    approved_at: now,
  }));

  // Admin is the wallet-holder regardless of who edits the match — offset their share if present.
  const { data: adminPlayer } = await supabase
    .from('players')
    .select('id')
    .eq('role', 'admin')
    .maybeSingle();

  if (adminPlayer && effectivePlayerIds.includes(adminPlayer.id)) {
    txRows.push({
      player_id: adminPlayer.id,
      amount: amountMap[adminPlayer.id],
      type: 'ADJUSTMENT',
      status: 'APPROVED',
      reference_id: id,
      notes: `Match on ${date} – admin share offset (paid by admin)`,
      approved_at: now,
    });
  }

  const { error: txError } = await supabase.from('transactions').insert(txRows);
  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  return NextResponse.json({ id, success: true });
}

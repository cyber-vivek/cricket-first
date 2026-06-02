import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireGameAdmin } from '@/lib/require-admin';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      creator:players!activities_created_by_fkey ( id, name ),
      activity_players (
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
  const { date, title, total_cost, player_shares, notes, admin_id } = await req.json();

  const authError = await requireGameAdmin(admin_id);
  if (authError) return authError;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

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

  // 1. Create activity record
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .insert({
      date,
      title: title.trim(),
      total_cost: Number(total_cost),
      notes: notes?.trim() || null,
      created_by: admin_id,
    })
    .select()
    .single();

  if (activityError) {
    return NextResponse.json({ error: activityError.message }, { status: 500 });
  }

  // 2. Create activity_players records
  const { error: apError } = await supabase
    .from('activity_players')
    .insert(effectivePlayerIds.map((pid: string) => ({
      activity_id: activity.id,
      player_id: pid,
      cost_share: amountMap[pid],
    })));

  if (apError) {
    return NextResponse.json({ error: apError.message }, { status: 500 });
  }

  // 3. Create APPROVED ACTIVITY transactions (negative = deduction)
  const now = new Date().toISOString();
  const txRows = effectivePlayerIds.map((pid: string) => ({
    player_id: pid,
    amount: -amountMap[pid],
    type: 'ACTIVITY',
    status: 'APPROVED',
    reference_id: activity.id,
    notes: `${title.trim()} on ${date} – ₹${amountMap[pid]} deducted`,
    approved_at: now,
  }));

  // Admin is the wallet-holder and pays regardless of who records — offset their share if present.
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
      reference_id: activity.id,
      notes: `${title.trim()} on ${date} – admin share offset (paid by admin)`,
      approved_at: now,
    });
  }

  const { error: txError } = await supabase.from('transactions').insert(txRows);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  return NextResponse.json(activity, { status: 201 });
}

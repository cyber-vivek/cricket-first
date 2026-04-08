import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
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
  const { date, title, total_cost, player_ids, notes, admin_id } = await req.json();

  const authError = await requireAdmin(admin_id);
  if (authError) return authError;

  if (!title?.trim() || !date || !total_cost || !Array.isArray(player_ids) || player_ids.length === 0) {
    return NextResponse.json(
      { error: 'Title, date, total cost and at least one player are required' },
      { status: 400 }
    );
  }

  const perPerson = Math.round((Number(total_cost) / player_ids.length) * 100) / 100;

  // 1. Create activity record
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .insert({ date, title: title.trim(), total_cost: Number(total_cost), notes: notes?.trim() || null })
    .select()
    .single();

  if (activityError) {
    return NextResponse.json({ error: activityError.message }, { status: 500 });
  }

  // 2. Create activity_players records
  const { error: apError } = await supabase
    .from('activity_players')
    .insert(player_ids.map((pid: string) => ({
      activity_id: activity.id,
      player_id: pid,
      cost_share: perPerson,
    })));

  if (apError) {
    return NextResponse.json({ error: apError.message }, { status: 500 });
  }

  // 3. Create APPROVED ACTIVITY transactions (negative = deduction)
  const { error: txError } = await supabase
    .from('transactions')
    .insert(player_ids.map((pid: string) => ({
      player_id: pid,
      amount: -perPerson,
      type: 'ACTIVITY',
      status: 'APPROVED',
      reference_id: activity.id,
      notes: `${title.trim()} on ${date} – ₹${perPerson} deducted`,
      approved_at: new Date().toISOString(),
    })));

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  return NextResponse.json(activity, { status: 201 });
}

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hashPin } from '@/lib/hash';

export async function GET(req: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const inactive = searchParams.get('inactive') === 'true';

  // Active players come from the view (already filters deactivated_at IS NULL)
  // Inactive players are queried directly from the players table
  if (inactive) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, phone, is_admin, created_at, deactivated_at')
      .not('deactivated_at', 'is', null)
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  }

  const { data, error } = await supabase
    .from('player_balances')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { name, phone, is_admin, pin } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const cleanPhone = phone?.trim() || null;
  if (!cleanPhone) {
    return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number' }, { status: 400 });
  }

  if (is_admin === true && !pin?.trim()) {
    return NextResponse.json({ error: 'PIN is required for admin accounts' }, { status: 400 });
  }

  // Insert without PIN first to get the generated UUID, then hash with it
  const { data, error } = await supabase
    .from('players')
    .insert({ name: name.trim(), phone: cleanPhone, is_admin: is_admin === true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store the hashed PIN for admin accounts
  if (is_admin === true) {
    await supabase
      .from('players')
      .update({ pin: hashPin(pin.trim(), data.id) })
      .eq('id', data.id);
  }

  return NextResponse.json({ ...data, balance: 0 }, { status: 201 });
}

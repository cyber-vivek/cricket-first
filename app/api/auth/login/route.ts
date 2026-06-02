import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hashPin } from '@/lib/hash';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { phone, pin } = await req.json();

  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
  }

  const { data: player, error } = await supabase
    .from('players')
    .select('id, name, phone, role, pin, created_at, deactivated_at')
    .eq('phone', phone.trim())
    .single();

  if (error || !player) {
    return NextResponse.json(
      { error: 'No player found with this phone number' },
      { status: 401 }
    );
  }

  if (player.deactivated_at) {
    return NextResponse.json(
      { error: 'This account has been removed' },
      { status: 401 }
    );
  }

  // Admin and game_admin accounts both require a PIN
  const needsPin = player.role === 'admin' || player.role === 'game_admin';
  if (needsPin) {
    if (!pin) {
      // Phase 1: tell the client a PIN is needed, but reveal nothing else
      return NextResponse.json({ requires_pin: true }, { status: 200 });
    }

    const expected = hashPin(String(pin), player.id);
    if (expected !== player.pin) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }
  }

  // Return player info without the PIN hash or deactivated_at
  const { pin: _pin, deactivated_at: _deleted, ...safePlayer } = player;
  return NextResponse.json({
    ...safePlayer,
    is_admin: player.role === 'admin',
  });
}

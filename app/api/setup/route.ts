import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hashPin } from '@/lib/hash';

export async function GET() {
  const supabase = createServerClient();

  // Check if any admin already exists
  const { count } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true);

  return NextResponse.json({ setup_required: count === 0 });
}

export async function POST(req: Request) {
  const supabase = createServerClient();

  // Lock: refuse if any admin already exists
  const { count } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true);

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Setup already complete. An admin account already exists.' },
      { status: 403 }
    );
  }

  const { name, phone, pin } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!phone?.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
    return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number' }, { status: 400 });
  }
  if (!pin?.trim()) {
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('players')
    .insert({ name: name.trim(), phone: phone.trim(), is_admin: true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from('players')
    .update({ pin: hashPin(pin.trim(), data.id) })
    .eq('id', data.id);

  return NextResponse.json({ success: true }, { status: 201 });
}

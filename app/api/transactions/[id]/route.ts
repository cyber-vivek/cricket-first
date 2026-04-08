import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/require-admin';

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { action, admin_id } = await req.json();

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'Action must be "approve" or "reject"' },
      { status: 400 }
    );
  }

  const authError = await requireAdmin(admin_id);
  if (authError) return authError;

  // Verify transaction exists and is still PENDING
  const { data: tx, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  if (tx.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Transaction is already ${tx.status.toLowerCase()}` },
      { status: 400 }
    );
  }

  const updatePayload =
    action === 'approve'
      ? { status: 'APPROVED', approved_at: new Date().toISOString() }
      : { status: 'REJECTED' };

  const { data, error } = await supabase
    .from('transactions')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

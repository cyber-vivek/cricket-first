'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

const QUICK_AMOUNTS = [100, 200, 300, 500, 1000];

export default function TopupPage() {
  const { user } = useAuth();
  const [myPending, setMyPending] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const fetchPending = () => {
    if (!user) return;
    fetch(`/api/transactions?status=PENDING&type=TOPUP&player_id=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setMyPending(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPending();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: user.id, amount: Number(amount), notes }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed to submit request');
    } else {
      setSuccess('Payment request submitted! Admin will approve shortly.');
      setAmount('');
      setNotes('');
      fetchPending();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Top Up Balance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paid admin via UPI? Report it here — admin will approve and update your balance.
        </p>
      </div>

      {/* UPI payment info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">Step 1 — Pay admin via UPI</p>
        <p className="text-sm text-blue-700">
          UPI ID:{' '}
          <span className="font-mono font-bold bg-blue-100 px-2 py-0.5 rounded">
            {process.env.NEXT_PUBLIC_ADMIN_UPI}
          </span>
        </p>
        <p className="text-sm text-blue-700">
          UPI NAME:{' '}
          <span className="font-mono font-bold px-2 py-0.5 rounded">
            {process.env.NEXT_PUBLIC_ADMIN_NAME}
          </span>
        </p>
        <p className="text-xs text-blue-500 mt-2">
          After paying, fill the form below to notify admin.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">Step 2 — Mark as Paid</p>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
            {user?.name}
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-2">Amount (₹)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_AMOUNTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAmount(String(s))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    amount === String(s)
                      ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  ₹{s}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Or enter custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0.01"
              step="0.01"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">UPI reference / Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. UPI ref: 4157203890"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Payment Request'}
          </button>
        </form>
      </div>

      {/* Pending requests list */}
      {!loading && myPending.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
            <h2 className="font-semibold text-amber-700 text-sm">
              Pending Requests ({myPending.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {myPending.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-xs text-gray-400">{tx.notes ?? 'No note'}</p>
                  <p className="text-xs text-gray-300">
                    {new Date(tx.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-amber-600 font-semibold text-sm">
                  ₹{Number(tx.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

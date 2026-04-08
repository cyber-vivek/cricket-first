'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Player, Transaction } from '@/lib/types';

type PlayerDetail = Player & { transactions: Transaction[] };

const TYPE_LABELS: Record<string, string> = {
  TOPUP: 'Top-up',
  MATCH: 'Match deduction',
  ADJUSTMENT: 'Adjustment',
  ACTIVITY: 'Activity',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/players/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPlayer(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p className="text-center text-gray-400 text-sm py-16">Loading…</p>;
  }

  if (!player || (player as unknown as { error: string }).error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 text-sm">Player not found.</p>
        <Link href="/players" className="text-blue-500 text-sm mt-2 inline-block">
          ← Back to Players
        </Link>
      </div>
    );
  }

  const bal = Number(player.balance ?? 0);
  const transactions = player.transactions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/players" className="text-xs text-blue-500 hover:underline">
          ← Players
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">{player.name}</h1>
        {player.phone && <p className="text-sm text-gray-400">{player.phone}</p>}
      </div>

      {/* Balance card */}
      <div
        className={`rounded-xl p-6 ${
          bal >= 0
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}
      >
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Current Balance
        </p>
        <p className={`text-4xl font-bold ${bal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {bal >= 0 ? '+' : ''}₹{bal.toFixed(2)}
        </p>
        <p className={`text-sm mt-1 ${bal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {bal >= 0 ? 'Has advance balance' : 'Owes money'}
        </p>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm">
            Transaction History ({transactions.length})
          </h2>
        </div>
        {transactions.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {transactions.map((tx) => {
              const amt = Number(tx.amount);
              const isDebit = tx.type === 'MATCH' || amt < 0;
              return (
                <li key={tx.id} className="flex items-start justify-between px-5 py-4 gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-700">
                        {TYPE_LABELS[tx.type] ?? tx.type}
                      </p>
                      {tx.status !== 'APPROVED' && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_BADGE[tx.status]
                          }`}
                        >
                          {tx.status.charAt(0) + tx.status.slice(1).toLowerCase()}
                        </span>
                      )}
                    </div>
                    {tx.notes && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.notes}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-0.5">
                      {new Date(tx.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span
                    className={`font-semibold text-sm whitespace-nowrap ${
                      tx.status !== 'APPROVED'
                        ? 'opacity-40 text-gray-500'
                        : isDebit
                        ? 'text-red-500'
                        : 'text-green-600'
                    }`}
                  >
                    {isDebit ? '' : '+'}₹{Math.abs(amt).toFixed(0)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

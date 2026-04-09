'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Player, Transaction } from '@/lib/types';

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [pending, setPending] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/players').then((r) => r.json()),
      fetch('/api/transactions?status=PENDING').then((r) => r.json()),
    ]).then(([playersData, pendingData]) => {
      setPlayers(Array.isArray(playersData) ? playersData : []);
      setPending(Array.isArray(pendingData) ? pendingData : []);
      setLoading(false);
    });
  }, []);

  const nonAdminPlayers = players.filter((p) => !p.is_admin);

  const totalHeld = players.reduce(
    (sum, p) => sum + Math.max(0, Number(p.balance ?? 0)),
    0
  );
  const totalOwed = players.reduce(
    (sum, p) => sum + Math.min(0, Number(p.balance ?? 0)),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Players" value={String(nonAdminPlayers.length)} color="gray" />
        <StatCard
          label="Money Holding"
          value={`₹${totalHeld.toFixed(2)}`}
          color="green"
          tooltip="Total advance balance held across all players — money paid by players that hasn't been used yet."
        />
        <StatCard
          label="Total Owed"
          value={`₹${Math.abs(totalOwed).toFixed(2)}`}
          color="red"
          tooltip="Total amount owed by players who have a negative balance — they need to top up."
        />
        <StatCard
          label="Pending Approvals"
          value={String(pending.length)}
          color="amber"
          link={pending.length > 0 ? '/admin' : undefined}
        />
      </div>

      {/* Player balances */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Player Balances</h2>
          <Link href="/players" className="text-xs text-blue-500 hover:underline">
            Manage →
          </Link>
        </div>
        {players.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No players yet.{' '}
            <Link href="/players" className="text-blue-500 hover:underline">
              Add players →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {players.map((player) => {
              const bal = Number(player.balance ?? 0);
              return (
                <li key={player.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/players/${player.id}`}
                        className="font-medium text-gray-800 hover:text-blue-600 text-sm"
                      >
                        {player.name}
                      </Link>
                      {player.is_admin && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                    {player.phone && (
                      <p className="text-xs text-gray-400">{player.phone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-semibold text-base ${
                        bal >= 0 ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {bal >= 0 ? '+' : ''}₹{bal.toFixed(2)}
                    </span>
                    <p className={`text-xs ${bal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {bal >= 0 ? 'advance' : 'owes'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction href="/matches" emoji="🏏" label="Record Match" desc="Add a new session & auto-split" />
        <QuickAction href="/topup" emoji="💰" label="Top Up" desc="Player reports a UPI payment" />
        <QuickAction href="/admin" emoji="✅" label="Approve Payments" desc={`${pending.length} pending`} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  link,
  tooltip,
}: {
  label: string;
  value: string;
  color: 'gray' | 'green' | 'red' | 'amber';
  link?: string;
  tooltip?: string;
}) {
  const valueColors = {
    gray: 'text-gray-800',
    green: 'text-green-600',
    red: 'text-red-500',
    amber: 'text-amber-500',
  };

  const card = (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 relative group">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        {tooltip && (
          <span className="relative">
            <span className="text-gray-300 text-xs cursor-default select-none">ⓘ</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed shadow-lg">
              {tooltip}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </span>
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
    </div>
  );

  return link ? <Link href={link}>{card}</Link> : card;
}

function QuickAction({
  href,
  emoji,
  label,
  desc,
}: {
  href: string;
  emoji: string;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3 hover:border-green-300 hover:shadow-md transition-all"
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

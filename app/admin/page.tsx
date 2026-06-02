'use client';

import { useEffect, useState } from 'react';
import { Player, Transaction } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

export default function AdminPage() {
  const { user } = useAuth();

  if (user && !user.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <h1 className="text-xl font-bold text-gray-800">Access Denied</h1>
        <p className="text-sm text-gray-500 mt-1">This page is only accessible to admins.</p>
      </div>
    );
  }

  const [pending, setPending] = useState<Transaction[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Manual add form
  const [addPlayer, setAddPlayer] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [activityType, setActivityType] = useState<'add' | 'refund'>('add');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Change PIN form
  const [showPinForm, setShowPinForm] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  // Game admin promote/revoke
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [promotePin, setPromotePin] = useState('');
  const [promoteConfirmPin, setPromoteConfirmPin] = useState('');
  const [promoteError, setPromoteError] = useState('');
  const [roleSubmitting, setRoleSubmitting] = useState<string | null>(null);

  const fetchData = () => {
    Promise.all([
      fetch('/api/transactions?status=PENDING').then((r) => r.json()),
      fetch('/api/players').then((r) => r.json()),
    ]).then(([pendingData, playersData]) => {
      setPending(Array.isArray(pendingData) ? pendingData : []);
      setPlayers(Array.isArray(playersData) ? playersData : []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id);
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_id: user?.id }),
    });
    if (res.ok) fetchData();
    setProcessing(null);
  };

  const handleChangePin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setPinSubmitting(true);
    const res = await fetch(`/api/players/${user?.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_pin', new_pin: newPin, admin_id: user?.id }),
    });

    const data = await res.json();
    if (!res.ok) {
      setPinError(data.error ?? 'Failed to change PIN');
    } else {
      setPinSuccess('PIN changed successfully');
      setNewPin('');
      setConfirmPin('');
    }
    setPinSubmitting(false);
  };

  const handlePromote = async (e: React.SyntheticEvent, playerId: string) => {
    e.preventDefault();
    setPromoteError('');

    if (promotePin !== promoteConfirmPin) {
      setPromoteError('PINs do not match');
      return;
    }
    if (promotePin.length < 4) {
      setPromoteError('PIN must be at least 4 characters');
      return;
    }

    setRoleSubmitting(playerId);
    const res = await fetch(`/api/players/${playerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_role',
        new_role: 'game_admin',
        new_pin: promotePin,
        admin_id: user?.id,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setPromoteError(data.error ?? 'Failed to promote');
    } else {
      setPromoteId(null);
      setPromotePin('');
      setPromoteConfirmPin('');
      fetchData();
    }
    setRoleSubmitting(null);
  };

  const handleRevoke = async (playerId: string) => {
    setRoleSubmitting(playerId);
    await fetch(`/api/players/${playerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_role',
        new_role: 'player',
        admin_id: user?.id,
      }),
    });
    fetchData();
    setRoleSubmitting(null);
  };

  const handleManualAdd = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    setAddSubmitting(true);

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: addPlayer,
        amount: Number(addAmount),
        notes: addNotes || (activityType === 'refund' ? 'Refund by admin' : 'Manual top-up by admin'),
        admin_direct: true,
        activity_type: activityType,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setAddError(data.error ?? 'Failed to add balance');
    } else {
      const player = players.find((p) => p.id === addPlayer);
      const action = activityType === 'refund' ? 'refunded to' : 'added to';
      setAddSuccess(`₹${addAmount} ${action} ${player?.name ?? 'player'}`);
      setAddPlayer('');
      setAddAmount('');
      setAddNotes('');
      setActivityType('add');
    }
    setAddSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Approve top-up requests and manage balances.</p>
      </div>

      {/* Pending approvals */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">
          Pending Approvals{' '}
          {!loading && (
            <span className="text-amber-500 font-bold">({pending.length})</span>
          )}
        </h2>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-gray-400 text-sm">All caught up! No pending requests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((tx) => (
              <div
                key={tx.id}
                className="bg-white rounded-xl border border-amber-100 shadow-sm p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">
                      {tx.players?.name ?? '—'}
                    </p>
                    <p className="text-2xl font-bold text-green-600 mt-0.5">
                      +₹{Number(tx.amount).toFixed(2)}
                    </p>
                    {tx.notes && (
                      <p className="text-sm text-gray-500 mt-1">{tx.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(tx.created_at).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(tx.id, 'approve')}
                      disabled={processing === tx.id}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {processing === tx.id ? '…' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => handleAction(tx.id, 'reject')}
                      disabled={processing === tx.id}
                      className="border border-red-200 text-red-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manual add balance */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Manual Balance Adjustment</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-4">
            Applied immediately without approval.
          </p>
          <form onSubmit={handleManualAdd} className="space-y-3">

            {/* Activity type toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit text-sm">
              <button
                type="button"
                onClick={() => setActivityType('add')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activityType === 'add'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Add Balance
              </button>
              <button
                type="button"
                onClick={() => setActivityType('refund')}
                className={`px-4 py-2 font-medium transition-colors border-l border-gray-200 ${
                  activityType === 'refund'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Refund
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Player</label>
                <select
                  value={addPlayer}
                  onChange={(e) => setAddPlayer(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  <option value="">Select player…</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{Number(p.balance ?? 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. Cash payment received"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            {addError && <p className="text-red-500 text-sm">{addError}</p>}
            {addSuccess && <p className="text-green-600 text-sm">{addSuccess}</p>}
            <button
              type="submit"
              disabled={addSubmitting}
              className={`text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                activityType === 'refund'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {addSubmitting
                ? 'Saving…'
                : activityType === 'refund'
                ? '− Refund Balance'
                : '+ Add Balance'}
            </button>
          </form>
        </div>
      </section>
      {/* Game admins */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Game Admins</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-4">
            Game admins can record matches and activities but cannot approve top-ups or adjust balances.
          </p>
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-4">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {players
                .filter((p) => p.role !== 'admin')
                .map((player) => {
                  const isGameAdmin = player.role === 'game_admin';
                  const isPromoting = promoteId === player.id;
                  return (
                    <li key={player.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-gray-800 text-sm truncate">
                            {player.name}
                          </span>
                          {isGameAdmin && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                              Game Admin
                            </span>
                          )}
                        </div>
                        {isGameAdmin ? (
                          <button
                            onClick={() => handleRevoke(player.id)}
                            disabled={roleSubmitting === player.id}
                            className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                          >
                            {roleSubmitting === player.id ? '…' : 'Revoke'}
                          </button>
                        ) : isPromoting ? (
                          <button
                            onClick={() => {
                              setPromoteId(null);
                              setPromotePin('');
                              setPromoteConfirmPin('');
                              setPromoteError('');
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setPromoteId(player.id);
                              setPromotePin('');
                              setPromoteConfirmPin('');
                              setPromoteError('');
                            }}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                          >
                            Make Game Admin
                          </button>
                        )}
                      </div>

                      {isPromoting && (
                        <form
                          onSubmit={(e) => handlePromote(e, player.id)}
                          className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">New PIN</label>
                            <input
                              type="password"
                              placeholder="Min 4 characters"
                              value={promotePin}
                              onChange={(e) => setPromotePin(e.target.value)}
                              required
                              autoFocus
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Confirm PIN</label>
                            <input
                              type="password"
                              placeholder="Re-enter PIN"
                              value={promoteConfirmPin}
                              onChange={(e) => setPromoteConfirmPin(e.target.value)}
                              required
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          {promoteError && (
                            <p className="text-red-500 text-xs sm:col-span-2">{promoteError}</p>
                          )}
                          <div className="sm:col-span-2">
                            <button
                              type="submit"
                              disabled={roleSubmitting === player.id}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                              {roleSubmitting === player.id ? 'Saving…' : 'Confirm Promote'}
                            </button>
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
              {players.filter((p) => p.role !== 'admin').length === 0 && (
                <li className="py-4 text-center text-sm text-gray-400">No other players yet.</li>
              )}
            </ul>
          )}
        </div>
      </section>

      {/* Change PIN */}
      <section>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setShowPinForm((v) => !v);
              setPinError('');
              setPinSuccess('');
              setNewPin('');
              setConfirmPin('');
            }}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <span>Change Admin PIN</span>
            <span className="text-gray-400">{showPinForm ? '▲' : '▼'}</span>
          </button>

          {showPinForm && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <form onSubmit={handleChangePin} className="space-y-3 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">New PIN</label>
                    <input
                      type="password"
                      placeholder="Enter new PIN"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Confirm PIN</label>
                    <input
                      type="password"
                      placeholder="Re-enter new PIN"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                </div>
                {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
                {pinSuccess && <p className="text-green-600 text-sm">{pinSuccess}</p>}
                <button
                  type="submit"
                  disabled={pinSubmitting}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {pinSubmitting ? 'Saving…' : 'Update PIN'}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

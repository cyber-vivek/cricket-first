'use client';

import { useEffect, useState } from 'react';
import { Player, Match, canManageGames } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [totalCost, setTotalCost] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [customSplit, setCustomSplit] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const fetchData = () => {
    Promise.all([
      fetch('/api/matches').then((r) => r.json()),
      fetch('/api/players').then((r) => r.json()),
    ]).then(([matchesData, playersData]) => {
      setMatches(Array.isArray(matchesData) ? matchesData : []);
      setPlayers(Array.isArray(playersData) ? playersData : []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((p) => p !== id);
        setCustomAmounts((ca) => { const c = { ...ca }; delete c[id]; return c; });
        return next;
      }
      return [...prev, id];
    });
  };

  const selectAll = () => {
    setSelectedPlayers(players.map((p) => p.id));
  };

  const deselectAll = () => {
    setSelectedPlayers([]);
    setCustomAmounts({});
  };

  const perPerson =
    selectedPlayers.length > 0 && totalCost
      ? (Number(totalCost) / selectedPlayers.length).toFixed(2)
      : null;

  const customTotal = selectedPlayers.reduce(
    (sum, pid) => sum + (Number(customAmounts[pid]) || 0),
    0
  );
  const remaining = totalCost ? Number(totalCost) - customTotal : 0;

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setDate(today);
    setTotalCost('');
    setSelectedPlayers([]);
    setNotes('');
    setCustomSplit(false);
    setCustomAmounts({});
    setError('');
  };

  const startEdit = (match: Match) => {
    const mps = match.match_players ?? [];
    const ids = mps.map((mp) => mp.player_id);
    const amounts: Record<string, string> = {};
    mps.forEach((mp) => { amounts[mp.player_id] = String(mp.cost_share); });
    const firstShare = mps[0] ? Number(mps[0].cost_share) : 0;
    const allSame = mps.length > 0 && mps.every((mp) => Number(mp.cost_share) === firstShare);

    setEditingId(match.id);
    setShowForm(true);
    setDate(match.date);
    setTotalCost(String(match.total_cost));
    setSelectedPlayers(ids);
    setNotes(match.notes ?? '');
    setCustomSplit(!allSame);
    setCustomAmounts(allSame ? {} : amounts);
    setError('');
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (selectedPlayers.length === 0) {
      setError('Select at least one player');
      return;
    }

    if (customSplit) {
      for (const pid of selectedPlayers) {
        if (!customAmounts[pid] || Number(customAmounts[pid]) <= 0) {
          setError('Enter a valid amount for every selected player');
          return;
        }
      }
      if (Math.abs(remaining) > 0.5) {
        setError(`Amounts must add up to ₹${totalCost}. Difference: ₹${remaining.toFixed(2)}`);
        return;
      }
    }

    setCreating(true);

    const perPersonAmount =
      Math.round((Number(totalCost) / selectedPlayers.length) * 100) / 100;

    const body = {
      date,
      total_cost: Number(totalCost),
      player_shares: selectedPlayers.map((pid) => ({
        player_id: pid,
        amount: customSplit ? Number(customAmounts[pid]) : perPersonAmount,
      })),
      notes,
      admin_id: user?.id,
    };

    const url = editingId ? `/api/matches/${editingId}` : '/api/matches';
    const method = editingId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? (editingId ? 'Failed to update match' : 'Failed to record match'));
    } else {
      resetForm();
      fetchData();
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Matches</h1>
        {canManageGames(user) && (
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            {showForm ? 'Close' : '+ New Match'}
          </button>
        )}
      </div>

      {/* Create match form — admin only */}
      {canManageGames(user) && showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 text-sm mb-4">
            {editingId ? 'Edit Match' : 'Record Match'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Total Court Cost (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 1200"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>

            {/* Split mode toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Split:</span>
              <button
                type="button"
                onClick={() => { setCustomSplit(false); setCustomAmounts({}); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !customSplit
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                Equal
              </button>
              <button
                type="button"
                onClick={() => setCustomSplit(true)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  customSplit
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                Custom
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">
                  Players{' '}
                  {selectedPlayers.length > 0 && !customSplit && (
                    <span className="text-green-600 font-medium">
                      ({selectedPlayers.length} selected
                      {perPerson ? ` · ₹${perPerson} each` : ''})
                    </span>
                  )}
                  {selectedPlayers.length > 0 && customSplit && (
                    <span className={`font-medium ${Math.abs(remaining) <= 0.5 ? 'text-green-600' : 'text-amber-500'}`}>
                      ({selectedPlayers.length} selected
                      {totalCost
                        ? remaining > 0.5
                          ? ` · ₹${remaining.toFixed(2)} unallocated`
                          : remaining < -0.5
                          ? ` · ₹${Math.abs(remaining).toFixed(2)} over`
                          : ' · balanced'
                        : ''})
                    </span>
                  )}
                </label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-blue-500 hover:underline"
                  >
                    All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-gray-400 hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              {!customSplit ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {players.map((player) => {
                    const selected = selectedPlayers.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => togglePlayer(player.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                          selected
                            ? 'border-green-400 bg-green-50 text-green-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs border ${
                            selected
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {selected ? '✓' : ''}
                        </span>
                        <span className="truncate">{player.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {players.map((player) => {
                    const selected = selectedPlayers.includes(player.id);
                    return (
                      <div
                        key={player.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                          selected
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => togglePlayer(player.id)}
                          className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs border ${
                            selected
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {selected ? '✓' : ''}
                        </button>
                        <span className={`flex-1 text-sm truncate ${selected ? 'text-green-700' : 'text-gray-500'}`}>
                          {player.name}
                        </span>
                        {selected && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">₹</span>
                            <input
                              type="number"
                              placeholder="0"
                              value={customAmounts[player.id] ?? ''}
                              onChange={(e) =>
                                setCustomAmounts((ca) => ({ ...ca, [player.id]: e.target.value }))
                              }
                              min="0"
                              step="any"
                              className="w-24 border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. Sunday morning game"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {creating
                  ? 'Saving…'
                  : editingId
                  ? '💾 Save Changes'
                  : '🏏 Record & Deduct'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Matches list */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
      ) : matches.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🏏</p>
          <p className="text-sm">No matches recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => {
            const mPlayers = match.match_players ?? [];
            const allSame = mPlayers.length > 0 && mPlayers.every(
              (mp) => Number(mp.cost_share) === Number(mPlayers[0].cost_share)
            );
            return (
              <div
                key={match.id}
                className={`bg-white rounded-xl border shadow-sm p-5 ${
                  editingId === match.id ? 'border-green-300 ring-1 ring-green-200' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      {new Date(match.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    {match.notes && (
                      <p className="text-xs text-gray-400 mt-0.5">{match.notes}</p>
                    )}
                    {match.creator?.name && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Added by {match.creator.name}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800">
                      ₹{Number(match.total_cost).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {mPlayers.length} player{mPlayers.length !== 1 ? 's' : ''}
                      {allSame && mPlayers.length > 0
                        ? ` · ₹${Number(mPlayers[0].cost_share).toFixed(2)} each`
                        : ' · custom split'}
                    </p>
                    {canManageGames(user) && (
                      <button
                        onClick={() => startEdit(match)}
                        className="text-xs text-blue-500 hover:underline mt-1"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mPlayers.map((mp) => (
                    <span
                      key={mp.id}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                      title={`₹${Number(mp.cost_share).toFixed(2)}`}
                    >
                      {mp.players?.name}
                      {!allSame && (
                        <span className="ml-1 text-gray-400">₹{Number(mp.cost_share).toFixed(2)}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Player, Activity } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

export default function ActivitiesPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const fetchData = () => {
    Promise.all([
      fetch('/api/activities').then((r) => r.json()),
      fetch('/api/players').then((r) => r.json()),
    ]).then(([activitiesData, playersData]) => {
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
      setPlayers(Array.isArray(playersData) ? playersData : []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const togglePlayer = (id: string) =>
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );

  const selectAll = () => setSelectedPlayers(players.map((p) => p.id));
  const deselectAll = () => setSelectedPlayers([]);

  const perPerson =
    selectedPlayers.length > 0 && totalCost
      ? (Number(totalCost) / selectedPlayers.length).toFixed(2)
      : null;

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (selectedPlayers.length === 0) {
      setError('Select at least one player');
      return;
    }

    setCreating(true);
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        title,
        total_cost: Number(totalCost),
        player_ids: selectedPlayers,
        notes,
        admin_id: user?.id,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed to record activity');
    } else {
      setShowForm(false);
      setDate(today);
      setTitle('');
      setTotalCost('');
      setSelectedPlayers([]);
      setNotes('');
      fetchData();
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Activities</h1>
          <p className="text-sm text-gray-500 mt-0.5">Breakfast, snacks, and other group expenses</p>
        </div>
        {user?.is_admin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + New Activity
          </button>
        )}
      </div>

      {/* Create activity form — admin only */}
      {user?.is_admin && showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 text-sm mb-4">Record Activity</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Activity Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Breakfast, Snacks"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Total Cost (₹)</label>
              <input
                type="number"
                placeholder="e.g. 400"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                required
                min="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">
                  Players{' '}
                  {selectedPlayers.length > 0 && (
                    <span className="text-green-600 font-medium">
                      ({selectedPlayers.length} selected
                      {perPerson ? ` · ₹${perPerson} each` : ''})
                    </span>
                  )}
                </label>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={selectAll} className="text-blue-500 hover:underline">All</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={deselectAll} className="text-gray-400 hover:underline">None</button>
                </div>
              </div>
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
                      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs border ${
                        selected ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
                      }`}>
                        {selected ? '✓' : ''}
                      </span>
                      <span className="truncate">{player.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. Post-match breakfast at dhaba"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? 'Saving…' : 'Record & Deduct'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activities list */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🍳</p>
          <p className="text-sm">No activities recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const aPlayers = activity.activity_players ?? [];
            return (
              <div key={activity.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(activity.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    {activity.notes && (
                      <p className="text-xs text-gray-400 mt-0.5">{activity.notes}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800">₹{Number(activity.total_cost).toFixed(0)}</p>
                    <p className="text-xs text-gray-400">
                      {aPlayers.length} player{aPlayers.length !== 1 ? 's' : ''}{' '}
                      {aPlayers.length > 0 ? `· ₹${Number(aPlayers[0].cost_share).toFixed(0)} each` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {aPlayers.map((ap) => (
                    <span key={ap.id} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                      {ap.players?.name}
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

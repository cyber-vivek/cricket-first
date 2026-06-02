'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Player } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

const PHONE_RE = /^[6-9]\d{9}$/;

export default function PlayersPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [inactive, setInactive] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [confirmInactive, setConfirmInactive] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchPlayers = () => {
    Promise.all([
      fetch('/api/players').then((r) => r.json()),
      fetch('/api/players?inactive=true').then((r) => r.json()),
    ]).then(([active, inactiveData]) => {
      setPlayers(Array.isArray(active) ? active : []);
      setInactive(Array.isArray(inactiveData) ? inactiveData : []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const validatePhone = (value: string) => {
    if (!value) return 'Phone number is required';
    if (!PHONE_RE.test(value)) return 'Enter a valid 10-digit Indian mobile number';
    return '';
  };

  const toggleActive = async (id: string, action: 'deactivate' | 'activate') => {
    setToggling(true);
    await fetch(`/api/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_id: user?.id }),
    });
    setConfirmInactive(null);
    fetchPlayers();
    setToggling(false);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed to add player');
    } else {
      setName('');
      setPhone('');
      setPhoneError('');
      fetchPlayers();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Players</h1>

      {/* Add player form — admin only */}
      {user?.is_admin && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm">Add New Player</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Player name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <div className="flex-1">
                <input
                  type="tel"
                  placeholder="Mobile number *"
                  value={phone}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(v);
                    if (phoneError) setPhoneError(validatePhone(v));
                  }}
                  onBlur={() => setPhoneError(validatePhone(phone))}
                  required
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                    phoneError ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {phoneError && (
                  <p className="text-red-500 text-xs mt-1">{phoneError}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap self-start"
              >
                {submitting ? 'Adding…' : '+ Add Player'}
              </button>
            </div>

            <p className="text-xs text-gray-400">
              To make a player a game admin, add them here first and then promote them from the Admin panel.
            </p>
          </form>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      )}

      {/* Active players list */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {players.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No players yet.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {players.map((player) => {
                const bal = Number(player.balance ?? 0);
                return (
                  <li
                    key={player.id}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-sm ${bal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {bal >= 0 ? '+' : ''}₹{bal.toFixed(2)}
                      </span>
                      <Link href={`/players/${player.id}`} className="text-xs text-gray-400 hover:text-blue-500">
                        View →
                      </Link>
                      {user?.is_admin && user.id !== player.id && (
                        confirmInactive === player.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleActive(player.id, 'deactivate')}
                              disabled={toggling}
                              className="text-xs bg-amber-500 text-white px-2 py-1 rounded-md hover:bg-amber-600 disabled:opacity-50"
                            >
                              {toggling ? '…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmInactive(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmInactive(player.id)}
                            className="text-xs text-amber-500 hover:text-amber-700"
                          >
                            Mark Inactive
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Inactive players — admin only */}
      {user?.is_admin && !loading && inactive.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            <span>Inactive Players ({inactive.length})</span>
            <span>{showInactive ? '▲' : '▼'}</span>
          </button>

          {showInactive && (
            <ul className="divide-y divide-gray-50 border-t border-gray-100">
              {inactive.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between px-5 py-4 bg-gray-50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-400 text-sm">{player.name}</span>
                      {player.is_admin && (
                        <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                    {player.phone && (
                      <p className="text-xs text-gray-400">{player.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(player.id, 'activate')}
                    disabled={toggling}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark Active
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

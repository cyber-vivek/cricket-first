'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const baseLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/activities', label: 'Activities' },
  { href: '/topup', label: 'Top Up' },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const links = user.is_admin
    ? [...baseLinks, { href: '/admin', label: 'Admin' }]
    : baseLinks;

  return (
    <nav className="bg-green-700 text-white shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-bold text-lg tracking-tight" onClick={() => setOpen(false)}>
          🏏 CricketFirst
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 text-sm">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-2 py-1 rounded-md transition-colors ${
                pathname === href
                  ? 'bg-green-900 text-white font-medium'
                  : 'text-green-100 hover:bg-green-600'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="ml-2 pl-2 border-l border-green-500 flex items-center gap-2">
            <span className="text-green-200 text-xs">{user.name}</span>
            <button
              onClick={logout}
              className="text-green-100 hover:text-white hover:bg-green-600 px-2 py-1 rounded-md transition-colors text-xs"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile: user name + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <span className="text-green-200 text-xs">{user.name}</span>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 rounded-md hover:bg-green-600 transition-colors"
            aria-label="Toggle menu"
          >
            <div className="space-y-1">
              <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${open ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${open ? '-translate-y-1.5 -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-green-600 px-4 py-2 space-y-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === href
                  ? 'bg-green-900 text-white font-medium'
                  : 'text-green-100 hover:bg-green-600'
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-green-100 hover:bg-green-600 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'CricketFirst – Court Cost Manager',
  description: 'Manage cricket court costs and player balances',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <AuthProvider>
          <NavBar />
          <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}

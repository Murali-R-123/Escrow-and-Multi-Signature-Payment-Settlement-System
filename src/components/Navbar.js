'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    api('/api/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
  }, [pathname]);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="nav">
      <span className="brand">🔐 Escrow Engine</span>
      {user && <Link href="/dashboard">Dashboard</Link>}
      {user?.role === 'BUYER' && <Link href="/escrows/new">New Escrow</Link>}
      {user && <Link href="/disputes">Disputes</Link>}
      {user?.role === 'ADMIN' && <Link href="/admin">Admin</Link>}
      <span className="spacer" />
      {user ? (
        <>
          <span className="who">{user.name} · {user.role}</span>
          <button className="secondary" onClick={logout}>Logout</button>
        </>
      ) : (
        <><Link href="/login">Login</Link><Link href="/register">Register</Link></>
      )}
    </nav>
  );
}

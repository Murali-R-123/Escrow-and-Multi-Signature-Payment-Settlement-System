'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: form });
      router.push('/dashboard'); router.refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="card auth">
      <h2>Sign in</h2>
      <form onSubmit={submit}>
        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Password</label>
        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <div className="msg err">{error}</div>}
        <p><button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></p>
      </form>
      <p className="muted">No account? <Link href="/register">Register</Link></p>
      <p className="muted">Demo: admin@escrow.test / alice.buyer@escrow.test / priya.seller@escrow.test / meera.arbiter@escrow.test — password <code>Password@123</code></p>
    </div>
  );
}

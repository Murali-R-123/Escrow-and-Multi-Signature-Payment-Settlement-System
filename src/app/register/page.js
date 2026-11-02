'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'BUYER' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/auth/register', { method: 'POST', body: form });
      router.push('/dashboard'); router.refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="card auth">
      <h2>Create account</h2>
      <form onSubmit={submit}>
        <label>Full name</label><input required minLength={2} value={form.name} onChange={set('name')} />
        <label>Email</label><input type="email" required value={form.email} onChange={set('email')} />
        <label>Password (min 8 characters)</label><input type="password" required minLength={8} value={form.password} onChange={set('password')} />
        <label>I am a…</label>
        <select value={form.role} onChange={set('role')}>
          <option value="BUYER">Buyer (funds escrows)</option>
          <option value="SELLER">Seller (receives payment)</option>
          <option value="ARBITRATOR">Arbitrator (signs &amp; resolves disputes)</option>
        </select>
        {error && <div className="msg err">{error}</div>}
        <p><button disabled={busy}>{busy ? 'Creating…' : 'Register'}</button></p>
      </form>
      <p className="muted">Already registered? <Link href="/login">Sign in</Link></p>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function NewEscrow() {
  const router = useRouter();
  const [sellers, setSellers] = useState([]);
  const [arbiters, setArbiters] = useState([]);
  const [form, setForm] = useState({ seller_id: '', arbitrator_id: '', amount: '', description: '', deadline: '', required_signatures: 2 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const totalSigners = form.arbitrator_id ? 3 : 2;

  useEffect(() => {
    api('/api/users?role=SELLER').then((d) => setSellers(d.users)).catch((e) => setError(e.message));
    api('/api/users?role=ARBITRATOR').then((d) => setArbiters(d.users)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const body = {
        ...form,
        arbitrator_id: form.arbitrator_id || null,
        required_signatures: Math.min(Number(form.required_signatures), totalSigners),
        deadline: new Date(form.deadline).toISOString(),
      };
      const d = await api('/api/escrows', { method: 'POST', body });
      router.push(`/escrows/${d.escrow_id}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>Create & fund an escrow</h2>
      <form onSubmit={submit}>
        <label>Seller</label>
        <select required value={form.seller_id} onChange={set('seller_id')}>
          <option value="">Select seller…</option>{sellers.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        <label>Arbitrator (optional – enables 2-of-3 / 3-of-3 rules)</label>
        <select value={form.arbitrator_id} onChange={set('arbitrator_id')}>
          <option value="">None (buyer + seller only)</option>{arbiters.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        <div className="row">
          <div><label>Amount (INR)</label><input type="number" step="0.01" min="0.01" required value={form.amount} onChange={set('amount')} /></div>
          <div><label>Signatures required (of {totalSigners})</label>
            <select value={Math.min(form.required_signatures, totalSigners)} onChange={set('required_signatures')}>
              {Array.from({ length: totalSigners }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} of {totalSigners}</option>)}
            </select>
          </div>
        </div>
        <label>Deadline</label><input type="datetime-local" required value={form.deadline} onChange={set('deadline')} />
        <label>Description</label><textarea rows={3} required minLength={3} maxLength={500} value={form.description} onChange={set('description')} />
        {error && <div className="msg err">{error}</div>}
        <p><button disabled={busy}>{busy ? 'Creating…' : 'Create escrow & deposit funds'}</button></p>
      </form>
    </div>
  );
}

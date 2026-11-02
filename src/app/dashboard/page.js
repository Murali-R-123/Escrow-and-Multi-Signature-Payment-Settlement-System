'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, money } from '@/lib/client';
import StatusBadge from '@/components/StatusBadge';

const STATUSES = ['PENDING', 'APPROVED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'EXPIRED'];

export default function Dashboard() {
  const [all, setAll] = useState([]);
  const [data, setData] = useState({ escrows: [], total: 0 });
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { // unfiltered snapshot for the stat cards
    api('/api/escrows?pageSize=100').then((d) => setAll(d.escrows)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { // filtered list (debounced search)
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (q.trim()) p.set('q', q.trim());
      api('/api/escrows?' + p.toString()).then(setData).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [status, q]);

  const count = (s) => all.filter((e) => e.status === s).length;

  return (
    <>
      <h1>My escrows</h1>
      {error && <div className="msg err">{error}</div>}
      <div className="grid g4" style={{ marginBottom: 18 }}>
        {STATUSES.map((s) => (
          <div className="stat" key={s} style={{ cursor: 'pointer' }} onClick={() => setStatus(status === s ? '' : s)}>
            <div className="n">{count(s)}</div><div className="l">{s}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div><label>Search (description, party name, id)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. laptop" /></div>
          <div><label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Description</th><th>Buyer → Seller</th><th>Amount</th><th>Signatures</th><th>Status</th><th>Deadline</th></tr></thead>
          <tbody>
            {data.escrows.map((e) => (
              <tr key={e.escrow_id}>
                <td><Link href={`/escrows/${e.escrow_id}`}>#{e.escrow_id}</Link></td>
                <td>{e.description}</td>
                <td>{e.buyer_name} → {e.seller_name}</td>
                <td>{money(e.amount)}</td>
                <td>{e.approvals_count}/{e.required_signatures} <span className="muted">of {e.total_signers}</span></td>
                <td><StatusBadge status={e.status} /></td>
                <td>{fmtDate(e.deadline)}</td>
              </tr>
            ))}
            {!data.escrows.length && <tr><td colSpan={7} className="muted">No escrows found.</td></tr>}
          </tbody>
        </table>
        <p className="muted">{data.total} result(s)</p>
      </div>
    </>
  );
}

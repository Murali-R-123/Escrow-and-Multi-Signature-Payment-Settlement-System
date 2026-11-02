'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, money } from '@/lib/client';
import StatusBadge from '@/components/StatusBadge';

export default function Disputes() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [pick, setPick] = useState({}); // dispute_id -> { outcome, note }

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (status) p.set('status', status);
    api('/api/disputes?' + p.toString()).then((d) => setRows(d.disputes)).catch((e) => setError(e.message));
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function resolve(id) {
    const v = pick[id] || { outcome: 'REFUND', note: '' };
    setError(''); setOk('');
    try { await api(`/api/disputes/${id}/resolve`, { method: 'POST', body: v }); setOk(`Dispute #${id} resolved (${v.outcome})`); load(); }
    catch (e) { setError(e.message); }
  }
  const set = (id, k, val) => setPick({ ...pick, [id]: { outcome: 'REFUND', note: '', ...(pick[id] || {}), [k]: val } });

  return (
    <>
      <h1>Disputes</h1>
      {error && <div className="msg err">{error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      <div className="card">
        <div className="row">
          <div><label>Full-text search in reasons</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. delivery delayed" /></div>
          <div><label>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option>OPEN</option><option>RESOLVED</option><option>REJECTED</option></select></div>
        </div>
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>#</th><th>Escrow</th><th>Raised by</th><th>Reason</th><th>Status</th><th>Raised</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.dispute_id}>
                <td>{d.dispute_id}</td>
                <td><Link href={`/escrows/${d.escrow_id}`}>#{d.escrow_id}</Link><div className="muted">{money(d.escrow_amount)}</div></td>
                <td>{d.raised_by_name}</td><td>{d.reason}</td>
                <td><StatusBadge status={d.status} />{d.resolved_by_name && <div className="muted">by {d.resolved_by_name}</div>}</td>
                <td>{fmtDate(d.created_at)}</td>
                <td>{d.can_resolve ? (
                  <div style={{ minWidth: 190 }}>
                    <select value={(pick[d.dispute_id] || {}).outcome || 'REFUND'} onChange={(e) => set(d.dispute_id, 'outcome', e.target.value)}>
                      <option value="REFUND">Refund buyer</option><option value="RELEASE">Release to seller</option><option value="DISMISS">Dismiss dispute</option></select>
                    <input placeholder="Note (audit log)" value={(pick[d.dispute_id] || {}).note || ''} onChange={(e) => set(d.dispute_id, 'note', e.target.value)} style={{ marginTop: 6 }} />
                    <button style={{ marginTop: 6 }} onClick={() => resolve(d.dispute_id)}>Resolve</button>
                  </div>) : ''}</td>
              </tr>))}
            {!rows.length && <tr><td colSpan={7} className="muted">No disputes found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, money } from '@/lib/client';

const ACTIONS = ['', 'USER_REGISTERED', 'USER_LOGIN', 'LOGIN_FAILED', 'ESCROW_CREATED', 'APPROVAL_SUBMITTED', 'ESCROW_APPROVED', 'FUNDS_RELEASED', 'DISPUTE_RAISED', 'DISPUTE_RESOLVED', 'ESCROWS_EXPIRED'];

function Bars({ rows, label, value, fmt = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[value])));
  return rows.map((r, i) => (
    <div key={i} style={{ marginBottom: 8 }}>
      <div className="muted">{r[label]} — <b>{fmt(r[value])}</b></div>
      <div className="bar"><div style={{ width: `${(Number(r[value]) / max) * 100}%` }} /></div>
    </div>
  ));
}

export default function Admin() {
  const [s, setS] = useState(null);
  const [events, setEvents] = useState([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const loadStats = useCallback(() => { api('/api/admin/stats').then(setS).catch((e) => setError(e.message)); }, []);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    api('/api/audit?limit=30' + (action ? `&action=${action}` : '')).then((d) => setEvents(d.events)).catch(() => setEvents([]));
  }, [action]);

  async function expire() {
    setError(''); setOk('');
    try { const d = await api('/api/admin/expire', { method: 'POST' }); setOk(`${d.expired_count} overdue escrow(s) refunded and expired`); loadStats(); }
    catch (e) { setError(e.message); }
  }

  if (!s) return error ? <div className="msg err">{error}</div> : <p className="muted">Loading…</p>;
  return (
    <>
      <h1>Admin dashboard</h1>
      {error && <div className="msg err">{error}</div>}
      {ok && <div className="msg ok">{ok}</div>}

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="n">{s.totals.escrows}</div><div className="l">Total escrows</div></div>
        <div className="stat"><div className="n">{money(s.totals.locked_value)}</div><div className="l">Value locked</div></div>
        <div className="stat"><div className="n">{s.totals.open_disputes}</div><div className="l">Open disputes</div></div>
        <div className="stat"><div className="n">{s.totals.overdue}</div><div className="l">Overdue escrows</div>
          <p><button className="secondary" onClick={expire}>Process expired</button></p></div>
      </div>

      <div className="grid g2">
        <div className="card"><h3>Value by status <span className="muted">(SQL GROUP BY)</span></h3>
          <Bars rows={s.byStatus} label="status" value="total" fmt={money} /></div>
        <div className="card"><h3>Monthly released <span className="muted">(SQL view)</span></h3>
          {s.monthly.length ? <Bars rows={s.monthly} label="month" value="total_released" fmt={money} /> : <p className="muted">No releases yet.</p>}</div>
        <div className="card"><h3>Top buyers <span className="muted">(GROUP BY + HAVING)</span></h3>
          <table><thead><tr><th>Buyer</th><th>Escrows</th><th>Total</th></tr></thead>
            <tbody>{s.topBuyers.map((b) => <tr key={b.name}><td>{b.name}</td><td>{b.escrows}</td><td>{money(b.total)}</td></tr>)}</tbody></table></div>
        <div className="card"><h3>Waiting for signatures <span className="muted">(view)</span></h3>
          <table><thead><tr><th>Escrow</th><th>Signer</th><th>Role</th></tr></thead>
            <tbody>{s.pendingSignatures.map((p, i) => <tr key={i}><td>#{p.escrow_id}</td><td>{p.signer_name}</td><td>{p.signer_role}</td></tr>)}
              {!s.pendingSignatures.length && <tr><td colSpan={3} className="muted">Nothing pending.</td></tr>}</tbody></table></div>
      </div>

      <div className="card">
        <h3>MongoDB aggregations</h3>
        {!s.audit ? <p className="msg err">MongoDB is offline or not initialised (run <code>npm run mongo:init</code>).</p> : (
          <div className="grid g2">
            <div><b>Events per action</b><div style={{ marginTop: 8 }}><Bars rows={s.audit.actionCounts.map((a) => ({ k: a._id, c: a.count }))} label="k" value="c" /></div></div>
            <div><b>Daily activity (14 days)</b><div style={{ marginTop: 8 }}>
              <Bars rows={s.audit.daily.map((a) => ({ k: a._id, c: a.events }))} label="k" value="c" /></div>
              <p><b>Most active actors</b></p>
              <table><tbody>{s.audit.topActors.map((a) => <tr key={a._id}><td>user #{a._id}</td><td>{a.events} events</td><td className="muted">{fmtDate(String(a.last_seen).replace('T', ' ').slice(0, 19))}</td></tr>)}</tbody></table></div>
          </div>)}
      </div>

      <div className="card">
        <h3>Audit log</h3>
        <label>Filter by action</label>
        <select value={action} onChange={(e) => setAction(e.target.value)} style={{ maxWidth: 260 }}>{ACTIONS.map((a) => <option key={a} value={a}>{a || 'All'}</option>)}</select>
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Escrow</th><th>Details</th></tr></thead>
          <tbody>{events.map((e) => (
            <tr key={e._id}><td>{new Date(e.ts).toLocaleString('en-IN')}</td><td>{e.action}</td><td>{e.actor_role || '-'} {e.actor_id ? `#${e.actor_id}` : ''}</td>
              <td>{e.escrow_id ? `#${e.escrow_id}` : '-'}</td><td><code>{JSON.stringify(e.meta)}</code></td></tr>))}
            {!events.length && <tr><td colSpan={5} className="muted">No events.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}

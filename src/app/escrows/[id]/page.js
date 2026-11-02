'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, fmtDate, money } from '@/lib/client';
import StatusBadge from '@/components/StatusBadge';

export default function EscrowDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/api/escrows/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(path, body, success) {
    setBusy(true); setError(''); setOk('');
    try { await api(`/api/escrows/${id}/${path}`, { method: 'POST', body }); setOk(success); setRemarks(''); setReason(''); load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!d) return error ? <div className="msg err">{error}</div> : <p className="muted">Loading…</p>;
  const { escrow: e, signers, transactions, disputes, audit, me } = d;
  const mySigner = me.signer;
  const iVoted = mySigner?.decision;
  const isParty = me.id === e.buyer_id || me.id === e.seller_id;
  const canVote = mySigner && !iVoted && e.status === 'PENDING';
  const canRelease = e.status === 'APPROVED' && (mySigner || me.role === 'ADMIN');
  const canDispute = isParty && ['PENDING', 'APPROVED'].includes(e.status);
  const pct = Math.min(100, Math.round((e.approvals_count / e.required_signatures) * 100));

  return (
    <>
      <h1>Escrow #{e.escrow_id} <StatusBadge status={e.status} /></h1>
      {error && <div className="msg err">{error}</div>}
      {ok && <div className="msg ok">{ok}</div>}

      <div className="card">
        <p>{e.description}</p>
        <div className="grid g4">
          <div><div className="l muted">Amount</div><b>{money(e.amount)}</b></div>
          <div><div className="l muted">Buyer</div>{e.buyer_name}</div>
          <div><div className="l muted">Seller</div>{e.seller_name}</div>
          <div><div className="l muted">Deadline</div>{fmtDate(e.deadline)}</div>
        </div>
        <p style={{ marginTop: 14 }}>Multi-signature progress: <b>{e.approvals_count} / {e.required_signatures}</b> approvals required
          <span className="muted"> ({e.required_signatures}-of-{e.total_signers} rule)</span></p>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        {e.status === 'PENDING' && e.approval_blocked ? <p className="msg err">Too many rejections: the threshold can no longer be reached. Raise a dispute or wait for expiry.</p> : null}
      </div>

      <div className="card">
        <h3>Signers</h3>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Decision</th><th>When</th><th>Remarks</th></tr></thead>
          <tbody>{signers.map((s) => (
            <tr key={s.user_id}><td>{s.name}</td><td>{s.signer_role}</td>
              <td>{s.decision ? <span className={`badge ${s.decision === 'APPROVE' ? 'APPROVED' : 'DISPUTED'}`}>{s.decision}</span> : <span className="muted">not voted</span>}</td>
              <td>{fmtDate(s.approved_at)}</td><td>{s.remarks || ''}</td></tr>))}</tbody>
        </table>

        {canVote && (
          <div style={{ marginTop: 14 }}>
            <label>Your remarks (optional)</label>
            <input value={remarks} maxLength={500} onChange={(ev) => setRemarks(ev.target.value)} />
            <p className="row" style={{ marginTop: 10 }}>
              <button className="ok" disabled={busy} onClick={() => act('approve', { decision: 'APPROVE', remarks }, 'Approval recorded')}>Approve release</button>
              <button className="danger" disabled={busy} onClick={() => act('approve', { decision: 'REJECT', remarks }, 'Rejection recorded')}>Reject</button>
            </p>
          </div>
        )}
        {canRelease && <p><button disabled={busy} onClick={() => act('release', {}, 'Funds released to the seller')}>Release funds to seller</button></p>}
      </div>

      {canDispute && (
        <div className="card">
          <h3>Raise a dispute</h3>
          <textarea rows={3} minLength={10} maxLength={1000} placeholder="Describe the problem (min 10 characters)" value={reason} onChange={(ev) => setReason(ev.target.value)} />
          <p><button className="danger" disabled={busy || reason.trim().length < 10} onClick={() => act('dispute', { reason }, 'Dispute raised; the arbitrator has been notified')}>Raise dispute</button></p>
        </div>
      )}

      <div className="grid g2">
        <div className="card">
          <h3>Ledger (transactions)</h3>
          <table><thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>{transactions.map((t) => (
              <tr key={t.transaction_id}><td>{t.transaction_id}</td><td>{t.transaction_type}</td><td>{money(t.amount)}</td><td>{t.transaction_status}</td><td>{fmtDate(t.created_at)}</td></tr>))}</tbody></table>
        </div>
        <div className="card">
          <h3>Disputes</h3>
          {!disputes.length && <p className="muted">None.</p>}
          {disputes.map((x) => (
            <p key={x.dispute_id}><StatusBadge status={x.status} /> #{x.dispute_id} by {x.raised_by_name}: {x.reason}
              {x.resolved_by_name && <span className="muted"> — resolved by {x.resolved_by_name} on {fmtDate(x.resolved_at)}</span>}</p>))}
        </div>
      </div>

      <div className="card">
        <h3>Audit trail <span className="muted">(MongoDB)</span></h3>
        {!audit.length && <p className="muted">No audit events (or MongoDB is offline).</p>}
        <ul className="timeline">
          {audit.map((ev) => (
            <li key={ev._id}><b>{ev.action}</b> <span className="muted">by {ev.actor_role || 'system'}{ev.actor_id ? ` #${ev.actor_id}` : ''} · {new Date(ev.ts).toLocaleString('en-IN')}</span>
              {ev.meta && Object.keys(ev.meta).length > 0 && <pre>{JSON.stringify(ev.meta)}</pre>}</li>))}
        </ul>
      </div>
    </>
  );
}

// Browser-side helpers
export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body !== undefined && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// DB returns UTC strings 'YYYY-MM-DD HH:MM:SS'
export function toDate(s) { return s ? new Date(String(s).replace(' ', 'T') + 'Z') : null; }
export function fmtDate(s) {
  const d = toDate(s);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}
export function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

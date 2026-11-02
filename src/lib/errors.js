import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Map MySQL / validation errors to clean JSON responses. */
export function errorResponse(err) {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (err?.sqlState === '45000') {            // raised by SIGNAL in procedures/triggers
    return NextResponse.json({ error: err.sqlMessage }, { status: 400 });
  }
  switch (err?.errno) {
    case 1062: return NextResponse.json({ error: 'Duplicate entry: this record already exists (for example, you already voted)' }, { status: 409 });
    case 3819: return NextResponse.json({ error: 'A database validation rule (CHECK constraint) was violated' }, { status: 400 });
    case 1452: return NextResponse.json({ error: 'A referenced record does not exist' }, { status: 400 });
    case 1265: case 1366: case 1292: case 1364:
      return NextResponse.json({ error: 'Invalid value for a database column' }, { status: 400 });
  }
  console.error('[api error]', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/** Wrap a route handler so every thrown error becomes a JSON response. */
export function route(handler) {
  return async (req, ctx) => {
    try { return await handler(req, ctx); } catch (e) { return errorResponse(e); }
  };
}

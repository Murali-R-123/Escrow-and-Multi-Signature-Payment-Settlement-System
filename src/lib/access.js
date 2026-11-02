import { query } from './mysql';
import { ApiError } from './errors';

/** ADMIN can see everything; others only escrows they are a party/signer of. */
export async function assertEscrowAccess(user, escrowId) {
  const id = Number(escrowId);
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid escrow id');
  const rows = await query('SELECT escrow_id, buyer_id, seller_id FROM escrows WHERE escrow_id = ?', [id]);
  if (!rows.length) throw new ApiError(404, 'Escrow not found');
  if (user.role === 'ADMIN') return id;
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM escrow_signers WHERE escrow_id = ? AND user_id = ?', [id, user.id]);
  if (rows[0].buyer_id !== user.id && rows[0].seller_id !== user.id && n === 0) {
    throw new ApiError(403, 'You are not a participant of this escrow');
  }
  return id;
}
